import { listGames, createGame, updateGame, deleteGame, listCategories, getFileUrl } from './appwriteService.js';
import { showSetupScreenForGame } from './setup.js';
import { showConfirmModal, showLinkModal, showNotification, showQuestionPreview } from './ui.js';

// --- Elements ---
const editGameScreen = document.getElementById('edit-game-screen');
const createNewGameBtn = document.getElementById('create-new-game-btn');
const duplicateSelectedGameBtn = document.getElementById('duplicate-selected-game-btn');
const gameEditorForm = document.getElementById('game-editor-form');
const gameNameInput = document.getElementById('game-name-input');
const gameDescriptionInput = document.getElementById('game-description-input');
const gameCategorySelect = document.getElementById('game-category-select');
const gamePublicCheckbox = document.getElementById('game-public-checkbox');
const questionsEditorContainer = document.getElementById('questions-editor-container');
const finalQuestionQInput = document.getElementById('final-question-q-input');
const finalQuestionAInput = document.getElementById('final-question-a-input');
const finalQuestionUrlInput = document.getElementById('final-question-url-input');
const toggleAllQuestionsBtn = document.getElementById('toggle-all-questions-btn');
const playSelectedGameBtn = document.getElementById('play-selected-game-btn');
const categoryListContainer = document.getElementById('category-list-container');
const gameListUl = document.getElementById('game-list-ul');

// New Toolbar Elements
const editorToolbar = document.getElementById('editor-toolbar');
const toolbarAddQuestionBtn = document.getElementById('toolbar-add-question-btn');
const toolbarDownloadBtn = document.getElementById('toolbar-download-btn');
const toolbarSaveBtn = document.getElementById('toolbar-save-btn');
const toolbarDeleteBtn = document.getElementById('toolbar-delete-btn');

// Modal Elements
const newGameModalOverlay = document.getElementById('new-game-modal-overlay');
const newGameNameInput = document.getElementById('new-game-name');
const newGameDescriptionInput = document.getElementById('new-game-description');
const newGameCategorySelect = document.getElementById('new-game-category');
const newGamePublicCheckbox = document.getElementById('new-game-public');
const confirmNewGameBtn = document.getElementById('confirm-new-game-btn');
const closeNewGameModalBtn = document.getElementById('close-new-game-modal-btn');


// --- State Management ---
let saveStateTimeout = null;
let gameDocumentsCache = {}; // Cache for all fetched game documents
let gameDataToDuplicate = null;
let userAcknowledgedUnsavedChanges = false;


/**
 * Sets the visual and functional state of the save button.
 * It's enabled and pulsing when there are unsaved changes, and disabled otherwise.
 * @param {boolean} isUnsaved - True to show unsaved state, false to reset to disabled.
 */
function setUnsavedState(isUnsaved) {
    // If the form is read-only, the save button should always be disabled and not pulsing.
    if (gameEditorForm.hasAttribute('data-readonly')) {
        toolbarSaveBtn.disabled = true;
        toolbarSaveBtn.classList.remove('unsaved');
        return;
    }

    // Clear any pending 'saved' state timeout if a change is made.
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
        toolbarSaveBtn.classList.remove('saved');
        toolbarSaveBtn.title = 'שמור שינויים';
        saveStateTimeout = null;
    }

    if (isUnsaved) {
        toolbarSaveBtn.classList.add('unsaved');
        toolbarSaveBtn.disabled = false; // Enable on change
    } else {
        toolbarSaveBtn.classList.remove('unsaved');
        toolbarSaveBtn.disabled = true; // Disable on load or after save
        userAcknowledgedUnsavedChanges = false; // Reset acknowledgment when changes are no longer unsaved
    }
}

/**
 * Shows a visual confirmation that the game has been saved successfully.
 * The button becomes green, then reverts to its default disabled state.
 */
function showSavedState() {
    // When called, the button has been clicked, so unsaved changes existed.
    toolbarSaveBtn.classList.remove('unsaved'); // Stop the pulse
    toolbarSaveBtn.classList.add('saved'); // Show the green checkmark
    toolbarSaveBtn.title = 'נשמר!';
    toolbarSaveBtn.disabled = true; // Keep it disabled
    userAcknowledgedUnsavedChanges = false; // Reset on successful save

    // Set a timeout to remove the 'saved' visual, reverting to the default disabled state.
    saveStateTimeout = setTimeout(() => {
        toolbarSaveBtn.classList.remove('saved');
        toolbarSaveBtn.title = 'שמור שינויים';
        // The button remains disabled. The next user edit will enable it via setUnsavedState(true).
        saveStateTimeout = null;
    }, 2000);
}


/**
 * Automatically adjusts the height of a textarea to fit its content.
 * @param {HTMLTextAreaElement} textarea - The textarea element to resize.
 */
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * Truncates text to a specific word limit.
 * @param {string} text The text to truncate.
 * @param {number} [limit=6] The word limit.
 * @returns {string} The truncated text.
 */
function truncateText(text, limit = 6) {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length > limit) {
        return words.slice(0, limit).join(' ') + '...';
    }
    return text;
}

/**
 * Updates the state of the toggle-all button based on the current state of the cards.
 */
function updateToggleAllButtonState() {
    const isAnyCollapsed = !!questionsEditorContainer.querySelector('.question-card.collapsed');
    if (isAnyCollapsed) {
        toggleAllQuestionsBtn.classList.remove('state-collapse');
        toggleAllQuestionsBtn.classList.add('state-expand');
        toggleAllQuestionsBtn.title = 'הרחב הכל';
    } else {
        toggleAllQuestionsBtn.classList.remove('state-expand');
        toggleAllQuestionsBtn.classList.add('state-collapse');
        toggleAllQuestionsBtn.title = 'כווץ הכל';
    }
}


/**
 * Updates the title of a collapsed card with a styled, truncated question text.
 * @param {HTMLDivElement} card The question card element.
 */
function updateCollapsedTitle(card) {
    const titleEl = card.querySelector('h3');
    const index = parseInt(card.dataset.index, 10);
    const questionText = card.querySelector('.question-input').value.trim();
    const truncated = truncateText(questionText);
    titleEl.innerHTML = `<span class="question-title-number">שאלה ${index + 1}:</span><span class="question-title-preview">${truncated}</span>`;
    titleEl.title = questionText;
}

/**
 * Collapses a single question card and updates its title.
 * @param {HTMLDivElement} card The question card element.
 */
function collapseCard(card) {
    card.classList.add('collapsed');
    updateCollapsedTitle(card);
    updateToggleAllButtonState();
}

/**
 * Expands a single question card and restores its title.
 * @param {HTMLDivElement} card The question card element.
 */
function expandCard(card) {
    card.classList.remove('collapsed');
    const titleEl = card.querySelector('h3');
    const index = parseInt(card.dataset.index, 10);
    titleEl.textContent = `שאלה ${index + 1}`;
    titleEl.title = '';
    updateToggleAllButtonState();
}


/**
 * Re-calculates and updates the displayed question number for all cards.
 */
function renumberQuestionCards() {
    const cards = questionsEditorContainer.querySelectorAll('.question-card');
    cards.forEach((card, i) => {
        card.dataset.index = i;
        if (card.classList.contains('collapsed')) {
            updateCollapsedTitle(card);
        } else {
            const titleEl = card.querySelector('h3');
            titleEl.textContent = `שאלה ${i + 1}`;
        }
    });
}

/**
 * Updates the state (enabled/disabled) of all reorder buttons.
 */
function updateReorderButtons() {
    const cards = questionsEditorContainer.querySelectorAll('.question-card');
    cards.forEach((card, index) => {
        const upBtn = card.querySelector('.reorder-up-btn');
        const downBtn = card.querySelector('.reorder-down-btn');
        if (upBtn) upBtn.disabled = (index === 0);
        if (downBtn) downBtn.disabled = (index === cards.length - 1);
    });
}

/**
 * Renders a single question card in the editor.
 * @param {object} question - The question object {q, a, timer, url}.
 * @param {number} index - The index of the question.
 * @returns {HTMLDivElement} The created card element.
 */
function renderQuestionCard(question, index) {
    const card = document.createElement('div');
    card.className = 'question-card collapsed';
    card.dataset.index = index;

    card.innerHTML = `
        <div class="question-card-header">
            <div class="header-left">
                <div class="reorder-controls">
                    <button type="button" class="reorder-btn reorder-up-btn" title="העבר למעלה">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg>
                    </button>
                    <button type="button" class="reorder-btn reorder-down-btn" title="העבר למטה">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41 1.41z"/></svg>
                    </button>
                </div>
                <h3>שאלה ${index + 1}</h3>
            </div>
            <div class="header-right">
                <button type="button" class="btn-icon preview-question-btn" title="תצוגת שאלה">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                </button>
                <button type="button" class="delete-question-btn" title="מחק שאלה"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                <svg class="collapse-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>
            </div>
        </div>
        <div class="question-card-body">
            <div class="form-group">
                <label>שאלה:</label>
                <textarea class="question-input" rows="1">${question.q}</textarea>
            </div>
            <div class="form-group">
                <label>תשובה:</label>
                <textarea class="answer-input" rows="1">${question.a}</textarea>
            </div>
            <div class="form-group">
                <label>קישור להרחבה:</label>
                <div class="input-with-button">
                    <input type="url" class="url-input" placeholder="הכנס קישור (אופציונלי)" value="${question.url || ''}">
                    <button type="button" class="btn-icon preview-link-btn" title="תצוגה מקדימה של הקישור" disabled>
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8v-2z"/></svg>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>טיימר (שניות):</label>
                <input type="number" class="timer-input" value="${question.timer}" min="5">
            </div>
        </div>
    `;

    const questionInput = card.querySelector('.question-input');
    const answerInput = card.querySelector('.answer-input');

    [questionInput, answerInput].forEach(textarea => {
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        setTimeout(() => autoResizeTextarea(textarea), 0);
    });

    questionInput.addEventListener('input', () => {
        if (card.classList.contains('collapsed')) {
            updateCollapsedTitle(card);
        }
    });

    const header = card.querySelector('.question-card-header');
    header.addEventListener('click', (e) => {
        // Allow toggling even in read-only to view questions/answers
        if (!e.target.closest('button')) {
            card.classList.contains('collapsed') ? expandCard(card) : collapseCard(card);
        }
    });

    card.querySelector('.preview-question-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card from toggling collapse
        const q = card.querySelector('.question-input').value;
        const a = card.querySelector('.answer-input').value;
        showQuestionPreview(q, a);
    });

    card.querySelector('.delete-question-btn').addEventListener('click', (e) => {
        const cardToDelete = e.currentTarget.closest('.question-card');
        
        // Add animation class
        cardToDelete.classList.add('deleting');
        
        // Set unsaved state immediately
        setUnsavedState(true);
    
        // Wait for the animation to end before removing the element and re-calculating
        cardToDelete.addEventListener('animationend', () => {
            cardToDelete.remove();
            renumberQuestionCards();
            updateReorderButtons();
            updateToggleAllButtonState();
        }, { once: true });
    });
    
    const moveUpBtn = card.querySelector('.reorder-up-btn');
    const moveDownBtn = card.querySelector('.reorder-down-btn');

    moveUpBtn.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const oldRect = button.getBoundingClientRect();
        const previousCard = card.previousElementSibling;
        if (previousCard) {
            questionsEditorContainer.insertBefore(card, previousCard);
            const newRect = button.getBoundingClientRect();
            const scrollDelta = newRect.top - oldRect.top;
            editGameScreen.querySelector('#editor-panel').scrollBy({ top: scrollDelta, behavior: 'auto' });
            renumberQuestionCards();
            updateReorderButtons();
            setUnsavedState(true);
        }
    });

    moveDownBtn.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const oldRect = button.getBoundingClientRect();
        const nextCard = card.nextElementSibling;
        if (nextCard) {
            questionsEditorContainer.insertBefore(nextCard, card);
            const newRect = button.getBoundingClientRect();
            const scrollDelta = newRect.top - oldRect.top;
            editGameScreen.querySelector('#editor-panel').scrollBy({ top: scrollDelta, behavior: 'auto' });
            renumberQuestionCards();
            updateReorderButtons();
            setUnsavedState(true);
        }
    });
    
    updateCollapsedTitle(card);
    return card;
}

/**
 * Clears and renders all questions for the currently loaded game.
 * @param {Array<object>} questions - An array of question objects.
 */
function renderAllQuestions(questions) {
    questionsEditorContainer.innerHTML = '';
    questions.forEach((q, i) => {
        const card = renderQuestionCard(q, i);
        questionsEditorContainer.appendChild(card);
    });
    updateReorderButtons();
    updateToggleAllButtonState();
}

/**
 * Sets the entire editor form to a read-only or editable state.
 * @param {boolean} isReadOnly - True to make the form read-only, false for editable.
 */
function setEditorReadOnly(isReadOnly) {
    gameEditorForm.toggleAttribute('data-readonly', isReadOnly);

    // Disable main form fields
    gameNameInput.disabled = isReadOnly;
    gameDescriptionInput.disabled = isReadOnly;
    gameCategorySelect.disabled = isReadOnly;
    gamePublicCheckbox.disabled = isReadOnly;
    finalQuestionQInput.disabled = isReadOnly;
    finalQuestionAInput.disabled = isReadOnly;
    finalQuestionUrlInput.disabled = isReadOnly;

    // Disable inputs and hide action buttons in each question card
    questionsEditorContainer.querySelectorAll('.question-card').forEach(card => {
        card.querySelector('.question-input').disabled = isReadOnly;
        card.querySelector('.answer-input').disabled = isReadOnly;
        card.querySelector('.timer-input').disabled = isReadOnly;
        card.querySelector('.url-input').disabled = isReadOnly;
        
        // Correctly set display property based on CSS. A standard button's default is 'inline-block'.
        card.querySelector('.delete-question-btn').style.display = isReadOnly ? 'none' : 'flex';
        card.querySelector('.reorder-controls').style.display = isReadOnly ? 'none' : 'flex';
        // The cursor is handled by CSS, no need to override it here.
    });

    // Hide editing-related toolbar buttons for read-only mode, as requested.
    toolbarAddQuestionBtn.style.display = isReadOnly ? 'none' : 'flex';
    toolbarSaveBtn.style.display = isReadOnly ? 'none' : 'flex';
    
    if (isReadOnly) {
        toolbarSaveBtn.classList.remove('unsaved'); // Ensure no unsaved pulse on read-only view
    }

    // A visual cue for the whole form
    gameEditorForm.style.opacity = isReadOnly ? 0.85 : 1;
}


/**
 * Fetches and loads a game's data into the editor form from Appwrite.
 * @param {object} gameDocument - The game document from Appwrite.
 */
async function loadGameForEditing(gameDocument) {
    if (!gameDocument) {
        gameEditorForm.classList.add('hidden');
        editorToolbar.classList.add('hidden');
        playSelectedGameBtn.disabled = true;
        duplicateSelectedGameBtn.disabled = true;
        setUnsavedState(false);
        return;
    }
    try {
        const gameData = JSON.parse(gameDocument.game_data);
        gameNameInput.value = gameDocument.game_name || '';
        gameDescriptionInput.value = gameDocument.description || '';
        gameCategorySelect.value = gameDocument.categoryId || '';
        gamePublicCheckbox.checked = gameDocument.is_public || false;
        renderAllQuestions(gameData.questions);
        
        if (gameData.final_question) {
            finalQuestionQInput.value = gameData.final_question.q || '';
            finalQuestionAInput.value = gameData.final_question.a || '';
            finalQuestionUrlInput.value = gameData.final_question.url || '';
        } else {
            finalQuestionQInput.value = '';
            finalQuestionAInput.value = '';
            finalQuestionUrlInput.value = '';
        }

        setTimeout(() => {
            autoResizeTextarea(gameDescriptionInput);
            autoResizeTextarea(finalQuestionQInput);
            autoResizeTextarea(finalQuestionAInput);
        }, 0);
        
        const isOwned = gameDocument.isOwned;
        setEditorReadOnly(!isOwned);
        
        // Hide delete button completely if not owned, using the correct display property ('flex')
        toolbarDeleteBtn.style.display = isOwned ? 'flex' : 'none';

        // Set initial state for all preview buttons
        gameEditorForm.querySelectorAll('input[type="url"]').forEach(input => {
            const wrapper = input.closest('.input-with-button');
            if(wrapper) {
                const previewBtn = wrapper.querySelector('.preview-link-btn');
                if (previewBtn) {
                    previewBtn.disabled = !input.value.trim() || !input.checkValidity();
                }
            }
        });

        gameEditorForm.dataset.documentId = gameDocument.$id;
        gameEditorForm.classList.remove('hidden');
        editorToolbar.classList.remove('hidden');
        playSelectedGameBtn.disabled = false;
        duplicateSelectedGameBtn.disabled = false;
        setUnsavedState(false);
    } catch (error) {
        console.error(`Failed to parse game data for ${gameDocument.game_name}:`, error);
        showNotification(`שגיאה בפענוח נתוני המשחק: ${gameDocument.game_name}. הנתונים עשויים להיות פגומים.`, 'error');
    }
}

/**
 * Fetches games for a specific category and populates the selection list.
 * @param {string|null} categoryId - The ID of the category to filter by. Null for all games.
 */
async function populateGameList(categoryId) {
    gameListUl.innerHTML = '<li>טוען משחקים...</li>';
    try {
        const games = await listGames(categoryId);
        gameListUl.innerHTML = '';
        gameDocumentsCache = {};

        if (games.length === 0) {
            gameListUl.innerHTML = '<li>לא נמצאו משחקים בקטגוריה זו.</li>';
            return;
        }

        games.forEach(game => {
            gameDocumentsCache[game.$id] = game;
            const li = document.createElement('li');
            li.dataset.documentId = game.$id;
            
            let content = `<span>${game.game_name}</span>`;
            
            // Add a visual indicator for public games not owned by the user
            if (!game.isOwned) {
                const publicIconSVG = `<svg class="public-game-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF" title="משחק ציבורי"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`;
                content = publicIconSVG + content;
            }
            
            li.innerHTML = content;
            gameListUl.appendChild(li);
        });
    } catch (error) {
        // The error notification is already shown by appwriteService,
        // so we just need to update the UI state.
        gameListUl.innerHTML = '<li>שגיאה בטעינת רשימת המשחקים</li>';
    }
}

/**
 * Gathers all question data from the form and compiles it into a game data object.
 * @returns {object|null} The compiled game data object or null if invalid.
 */
function compileGameData() {
    const questions = [];
    const questionCards = questionsEditorContainer.querySelectorAll('.question-card');
    
    questionCards.forEach(card => {
        const q = card.querySelector('.question-input').value.trim();
        const a = card.querySelector('.answer-input').value.trim();
        const url = card.querySelector('.url-input').value.trim();
        const timer = parseInt(card.querySelector('.timer-input').value, 10);

        if (q && a && !isNaN(timer)) {
            const questionData = { q, a, timer };
            if (url) {
                questionData.url = url;
            }
            questions.push(questionData);
        }
    });
    
    const finalQuestionQ = finalQuestionQInput.value.trim();
    const finalQuestionA = finalQuestionAInput.value.trim();
    const finalQuestionUrl = finalQuestionUrlInput.value.trim();
    
    let final_question = null;
    if (finalQuestionQ && finalQuestionA) {
        final_question = { q: finalQuestionQ, a: finalQuestionA };
        if (finalQuestionUrl) {
            final_question.url = finalQuestionUrl;
        }
    }

    return { questions, final_question };
}

/**
 * Triggers a browser download for the provided data.
 * @param {string} filename - The name of the file to download.
 * @param {object} data - The JS object to convert to JSON and download.
 */
function downloadJsonFile(filename, data) {
    const jsonString = JSON.stringify(data, null, 4);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Fetches categories and populates the editor and new game modal dropdowns.
 */
async function populateCategorySelectors() {
    const selectors = [gameCategorySelect, newGameCategorySelect];
    selectors.forEach(sel => sel.innerHTML = '');

    try {
        const categories = await listCategories();
        if (categories.length === 0) {
            selectors.forEach(sel => {
                const option = document.createElement('option');
                option.textContent = 'לא נמצאו קטגוריות';
                option.disabled = true;
                sel.appendChild(option);
            });
            return;
        }

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.$id;
            option.textContent = category.name;
            gameCategorySelect.appendChild(option);
            newGameCategorySelect.appendChild(option.cloneNode(true));
        });

    } catch (error) {
        // The service shows a notification. We just update the UI state.
        selectors.forEach(sel => {
            const option = document.createElement('option');
            option.textContent = 'שגיאה בטעינת קטגוריות';
            option.disabled = true;
            sel.appendChild(option);
        });
    }
}

/**
 * Fetches and renders the category selection cards.
 */
async function renderCategories() {
    categoryListContainer.innerHTML = '<span>טוען קטגוריות...</span>';
    
    try {
        const categories = await listCategories();
        categoryListContainer.innerHTML = '';

        const allCard = document.createElement('div');
        allCard.className = 'category-card selected';
        allCard.dataset.categoryId = 'all';
        allCard.innerHTML = `<img src="https://img.icons8.com/plasticine/100/question-mark.png" alt="הכל"><span>הכל</span>`;
        categoryListContainer.appendChild(allCard);

        categories.forEach(category => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.categoryId = category.$id;
            const imageUrl = category.imageId ? getFileUrl(category.imageId) : 'https://img.icons8.com/plasticine/100/folder-invoices.png';
            card.innerHTML = `<img src="${imageUrl}" alt="${category.name}"><span>${category.name}</span>`;
            categoryListContainer.appendChild(card);
        });

    } catch (error) {
        // The service shows a notification. We just update the UI state.
        categoryListContainer.innerHTML = '<span>שגיאה בטעינת קטגוריות</span>';
    }
}

/**
 * Shows the main edit screen and populates the game list.
 */
export async function showEditScreen() {
    editGameScreen.classList.remove('hidden');
    gameEditorForm.classList.add('hidden');
    editorToolbar.classList.add('hidden');
    playSelectedGameBtn.disabled = true;
    duplicateSelectedGameBtn.disabled = true;
    document.getElementById('global-home-btn').classList.remove('hidden');
    delete gameEditorForm.dataset.documentId;
    
    await Promise.all([
        populateCategorySelectors(),
        renderCategories()
    ]);
    await populateGameList(null);
}

/**
 * A central handler for actions that might discard unsaved changes.
 * It shows a modal with "Save", "Don't Save", and "Cancel" options.
 * @param {function} actionCallback The function to execute if the user decides to proceed.
 */
export async function checkForUnsavedChangesAndProceed(actionCallback) {
    const isUnsaved = toolbarSaveBtn.classList.contains('unsaved');
    const isEditorVisible = !editGameScreen.classList.contains('hidden');

    if (!isEditorVisible || !isUnsaved || userAcknowledgedUnsavedChanges) {
        if (actionCallback) actionCallback();
        return;
    }

    const result = await showConfirmModal('יש לך שינויים שלא נשמרו. מה ברצונך לעשות?', 'save_flow');

    switch (result) {
        case 'save':
            const wasSaveSuccessful = await handleSave();
            if (wasSaveSuccessful && actionCallback) {
                actionCallback();
            }
            break;
        case 'dont_save':
            userAcknowledgedUnsavedChanges = true;
            if (actionCallback) actionCallback();
            break;
        case 'cancel':
        case false:
        default:
            // Do nothing, user stays on the page.
            break;
    }
}

/**
 * The logic for saving the game, extracted into a reusable async function.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on failure.
 */
async function handleSave() {
    const documentId = gameEditorForm.dataset.documentId;
    if (!documentId) {
        showNotification('לא נבחר משחק לשמירה.', 'info');
        return false;
    }
    const gameName = gameNameInput.value.trim();
    if (!gameName) {
        showNotification('יש להזין שם למשחק.', 'error');
        return false;
    }
    const description = gameDescriptionInput.value.trim();
    const categoryId = gameCategorySelect.value;
    const isPublic = gamePublicCheckbox.checked;
    const gameData = compileGameData();
    
    try {
        toolbarSaveBtn.disabled = true;
        await updateGame(documentId, gameName, description, categoryId, gameData, isPublic);
        showSavedState();
        showNotification('המשחק נשמר בהצלחה!', 'success');
        const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
        await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
        const liToSelect = gameListUl.querySelector(`li[data-document-id="${documentId}"]`);
        if(liToSelect) liToSelect.classList.add('selected');
        return true;
    } catch (e) {
        toolbarSaveBtn.disabled = false;
        return false;
    }
}

/**
 * Initializes all event listeners for the edit game screen.
 */
export function initializeEditGameScreen() {
    categoryListContainer.addEventListener('click', (e) => {
        const selectedCard = e.target.closest('.category-card');
        if (!selectedCard || selectedCard.classList.contains('selected')) return;

        const proceed = () => {
            categoryListContainer.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
            selectedCard.classList.add('selected');
            const categoryId = selectedCard.dataset.categoryId;
            populateGameList(categoryId === 'all' ? null : categoryId);
            loadGameForEditing(null);
        };
        checkForUnsavedChangesAndProceed(proceed);
    });

    gameListUl.addEventListener('click', (e) => {
        const selectedLi = e.target.closest('li');
        if (!selectedLi || !selectedLi.dataset.documentId || selectedLi.classList.contains('selected')) return;

        const proceed = () => {
            gameListUl.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
            selectedLi.classList.add('selected');
            const gameDoc = gameDocumentsCache[selectedLi.dataset.documentId];
            loadGameForEditing(gameDoc);
        };
        checkForUnsavedChangesAndProceed(proceed);
    });

    playSelectedGameBtn.addEventListener('click', () => {
        const proceed = () => {
            const selectedLi = gameListUl.querySelector('li.selected');
            if(!selectedLi) {
                showNotification('יש לבחור משחק תחילה.', 'info');
                return;
            }
            const gameDoc = gameDocumentsCache[selectedLi.dataset.documentId];
            editGameScreen.classList.add('hidden');
            document.getElementById('global-header').classList.add('hidden');
            showSetupScreenForGame(gameDoc);
        };
        checkForUnsavedChangesAndProceed(proceed);
    });

    createNewGameBtn.addEventListener('click', () => {
        const proceed = () => {
            const selectedCategoryCard = categoryListContainer.querySelector('.category-card.selected');
            const selectedCategoryId = selectedCategoryCard ? selectedCategoryCard.dataset.categoryId : null;

            if (selectedCategoryId && selectedCategoryId !== 'all') {
                newGameCategorySelect.value = selectedCategoryId;
            } else if (newGameCategorySelect.options.length > 0) {
                newGameCategorySelect.selectedIndex = 0;
            }
            newGameModalOverlay.classList.remove('hidden');
            newGameNameInput.focus();
        };
        checkForUnsavedChangesAndProceed(proceed);
    });


    // --- Link Preview Listeners ---
    gameEditorForm.addEventListener('input', (e) => {
        const input = e.target;
        if (input.matches('input[type="url"]')) {
            const wrapper = input.closest('.input-with-button');
            if (wrapper) {
                const previewBtn = wrapper.querySelector('.preview-link-btn');
                if (previewBtn) {
                    previewBtn.disabled = !input.value.trim() || !input.checkValidity();
                }
            }
        }
    });

    editGameScreen.addEventListener('click', (e) => {
        const previewBtn = e.target.closest('.preview-link-btn');
        if (previewBtn && !previewBtn.disabled) {
            const urlInput = previewBtn.closest('.input-with-button')?.querySelector('input[type="url"]');
            if (urlInput && urlInput.value) {
                showLinkModal(urlInput.value);
            }
        }
    });

    gameEditorForm.addEventListener('input', () => setUnsavedState(true));

    toolbarAddQuestionBtn.addEventListener('click', () => {
        if (gameEditorForm.classList.contains('hidden')) {
            showNotification('יש לבחור משחק לפני הוספת שאלה.', 'info');
            return;
        }
        const questionCount = questionsEditorContainer.children.length;
        const newCard = renderQuestionCard({ q: '', a: '', timer: 30, url: '' }, questionCount);
        questionsEditorContainer.appendChild(newCard);
    
        updateReorderButtons();
        updateToggleAllButtonState();
        setUnsavedState(true);
    
        expandCard(newCard);
        newCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
        const questionInput = newCard.querySelector('.question-input');
        if (questionInput) {
            questionInput.focus({ preventScroll: true });
        }
    });

    toolbarSaveBtn.addEventListener('click', handleSave);

    toolbarDeleteBtn.addEventListener('click', async () => {
        const documentId = gameEditorForm.dataset.documentId;
        const gameName = gameNameInput.value.trim();
        if (!documentId) return;
        
        const userConfirmed = await showConfirmModal(`האם אתה בטוח שברצונך למחוק את המשחק "${gameName}"? לא ניתן לשחזר פעולה זו.`);
        if (userConfirmed) {
            try {
                await deleteGame(documentId);
                showNotification(`המשחק "${gameName}" נמחק בהצלחה.`, 'success');
                loadGameForEditing(null);
                const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
                await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
            } catch (error) {
                // The error is already handled and shown by the service layer.
            }
        }
    });

    toolbarDownloadBtn.addEventListener('click', () => {
        if (gameEditorForm.classList.contains('hidden')) {
            showNotification('לא נבחר משחק להורדה. אנא בחר משחק קיים.', 'info');
            return;
        }
        const gameName = gameNameInput.value.trim();
        const description = gameDescriptionInput.value.trim();
        const categoryId = gameCategorySelect.value;
        const gameData = compileGameData();
        const fullGameJson = { game_name: gameName, description, categoryId, ...gameData };
        const fileName = `${gameName.replace(/\s+/g, '_')}.json`;
        downloadJsonFile(fileName, fullGameJson);
    });

    toggleAllQuestionsBtn.addEventListener('click', () => {
        const cards = questionsEditorContainer.querySelectorAll('.question-card');
        if (toggleAllQuestionsBtn.classList.contains('state-expand')) {
            cards.forEach(expandCard);
        } else {
            cards.forEach(collapseCard);
        }
    });

    duplicateSelectedGameBtn.addEventListener('click', () => {
        const proceed = () => {
            const selectedLi = gameListUl.querySelector('li.selected');
            if (!selectedLi) {
                showNotification('יש לבחור משחק לשכפול.', 'info');
                return;
            }
            const gameDoc = gameDocumentsCache[selectedLi.dataset.documentId];
            if (!gameDoc) return;
            try {
                gameDataToDuplicate = JSON.parse(gameDoc.game_data);
            } catch(e) {
                showNotification('שגיאה בנתוני המשחק המקורי.', 'error');
                gameDataToDuplicate = null;
                return;
            }
            newGameNameInput.value = `עותק של ${gameDoc.game_name}`;
            newGameDescriptionInput.value = gameDoc.description || '';
            newGameCategorySelect.value = gameDoc.categoryId || '';
            newGamePublicCheckbox.checked = gameDoc.is_public || false;
            newGameModalOverlay.classList.remove('hidden');
            newGameNameInput.focus();
            newGameNameInput.select();
        };
        checkForUnsavedChangesAndProceed(proceed);
    });


    closeNewGameModalBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.add('hidden');
        gameDataToDuplicate = null;
    });

    confirmNewGameBtn.addEventListener('click', async () => {
        const newName = newGameNameInput.value.trim();
        const newDescription = newGameDescriptionInput.value.trim();
        const newCategoryId = newGameCategorySelect.value;
        const isPublic = newGamePublicCheckbox.checked;

        if (!newName || !newCategoryId) {
            showNotification('יש למלא שם וקטגוריה למשחק.', 'error');
            return;
        }
        
        const newGameData = gameDataToDuplicate || { questions: [], final_question: { q: "", a: "", url: "" } };
    
        try {
            const newDocument = await createGame(newName, newDescription, newCategoryId, newGameData, isPublic);
            
            newGameModalOverlay.classList.add('hidden');
            newGameNameInput.value = '';
            newGameDescriptionInput.value = '';
            newGamePublicCheckbox.checked = false;
            
            gameDataToDuplicate = null; // Reset after use
    
            const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
            await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
            
            const liToSelect = gameListUl.querySelector(`li[data-document-id="${newDocument.$id}"]`);
            if(liToSelect) liToSelect.click();
    
            showNotification(`משחק חדש "${newName}" נוצר. כעת ניתן לערוך אותו.`, 'success');
        } catch(e) {
            // The service layer handles showing the error notification.
            gameDataToDuplicate = null; // Also reset on error
        }
    });
    
    gameDescriptionInput.addEventListener('input', () => autoResizeTextarea(gameDescriptionInput));
    finalQuestionQInput.addEventListener('input', () => autoResizeTextarea(finalQuestionQInput));
    finalQuestionAInput.addEventListener('input', () => autoResizeTextarea(finalQuestionAInput));
    newGameDescriptionInput.addEventListener('input', () => autoResizeTextarea(newGameDescriptionInput));
}