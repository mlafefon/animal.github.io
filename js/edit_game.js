
import { listGames, createGame, updateGame, deleteGame, listCategories, getFileUrl } from './appwriteService.js';
import { showSetupScreenForGame } from './setup.js';
import { showConfirmModal, showLinkModal, showNotification, showQuestionPreview } from './ui.js';
import { getSavedState, resetState } from './gameState.js';

// --- Elements ---
const editGameScreen = document.getElementById('edit-game-screen');
const createNewGameBtn = document.getElementById('create-new-game-btn');
const gameListUl = document.getElementById('game-list-ul');
const categoryListContainer = document.getElementById('category-list-container');

// Editor Panel Containers
const editorPanel = document.getElementById('editor-panel');
const editorPlaceholder = document.getElementById('editor-placeholder');
const gameViewPanel = document.getElementById('game-view-panel');
const editorContainer = document.getElementById('editor-container'); // Wraps toolbar and form
const continueViewPanel = document.getElementById('continue-view-panel');

// View Panel Elements
const viewGameName = document.getElementById('view-game-name');
const viewGameDescription = document.getElementById('view-game-description');
const viewGameCategory = document.getElementById('view-game-category');
const viewGameStatus = document.getElementById('view-game-status');
const viewGameQCount = document.getElementById('view-game-q-count');
const viewQuestionsList = document.getElementById('view-questions-list');
const viewPlayBtn = document.getElementById('view-play-btn');
const viewEditBtn = document.getElementById('view-edit-btn');
const viewDuplicateBtn = document.getElementById('view-duplicate-btn');
const viewDeleteBtn = document.getElementById('view-delete-btn');
const viewToggleQuestionsBtn = document.getElementById('view-toggle-questions-btn');
const viewToggleAllQuestionsBtn = document.getElementById('view-toggle-all-questions-btn');

// Editor Form Elements
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

// Toolbar Elements
const toolbarAddQuestionBtn = document.getElementById('toolbar-add-question-btn');
const toolbarDownloadBtn = document.getElementById('toolbar-download-btn');
const toolbarSaveBtn = document.getElementById('toolbar-save-btn');
const toolbarCancelBtn = document.getElementById('toolbar-cancel-btn');

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
let currentlySelectedGameDoc = null;
let allCategories = [];
let onStartGameCallback = null;


/**
 * Sets the visual and functional state of the save button.
 * @param {boolean} isUnsaved - True to show unsaved state, false to reset to disabled.
 */
function setUnsavedState(isUnsaved) {
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
        toolbarSaveBtn.classList.remove('saved');
        toolbarSaveBtn.title = 'שמור שינויים';
        saveStateTimeout = null;
    }

    if (isUnsaved) {
        toolbarSaveBtn.classList.add('unsaved');
        toolbarSaveBtn.disabled = false;
    } else {
        toolbarSaveBtn.classList.remove('unsaved');
        toolbarSaveBtn.disabled = true;
        userAcknowledgedUnsavedChanges = false;
    }
}

/**
 * Shows a visual confirmation that the game has been saved successfully.
 */
function showSavedState() {
    toolbarSaveBtn.classList.remove('unsaved');
    toolbarSaveBtn.classList.add('saved');
    toolbarSaveBtn.title = 'נשמר!';
    toolbarSaveBtn.disabled = true;
    userAcknowledgedUnsavedChanges = false;

    saveStateTimeout = setTimeout(() => {
        toolbarSaveBtn.classList.remove('saved');
        toolbarSaveBtn.title = 'שמור שינויים';
        saveStateTimeout = null;
    }, 2000);
}


/**
 * Automatically adjusts the height of a textarea to fit its content.
 * @param {HTMLTextAreaElement} textarea - The textarea element to resize.
 */
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    
    // Capture scroll position of the form container to prevent jumping
    // when the textarea momentarily shrinks (setting height to 'auto').
    const previousScrollTop = gameEditorForm ? gameEditorForm.scrollTop : 0;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;

    if (gameEditorForm) {
        // Restore scroll position. If the content shrank during 'auto' and 
        // clamped the scroll, this puts it back to the stable position.
        gameEditorForm.scrollTop = previousScrollTop;
    }
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
 * Updates the state of the editor's toggle-all button based on the current state of the cards.
 */
function updateEditorToggleAllButtonState() {
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
 * Updates the state of the view panel's toggle-all button based on the current state of the cards.
 */
function updateViewToggleAllButtonState() {
    if (!viewQuestionsList || viewQuestionsList.classList.contains('hidden')) return;

    // An item is considered "collapsed" if it does NOT have the 'open' class.
    const isAnyCollapsed = !!viewQuestionsList.querySelector('.view-question-item:not(.open)');
    
    // If any item is collapsed, the button should show the "Expand All" icon/state.
    if (isAnyCollapsed) {
        viewToggleAllQuestionsBtn.classList.remove('state-collapse');
        viewToggleAllQuestionsBtn.classList.add('state-expand');
        viewToggleAllQuestionsBtn.title = 'הרחב הכל';
    } else {
        // If all items are open, the button should show the "Collapse All" icon/state.
        viewToggleAllQuestionsBtn.classList.remove('state-expand');
        viewToggleAllQuestionsBtn.classList.add('state-collapse');
        viewToggleAllQuestionsBtn.title = 'כווץ הכל';
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
    updateEditorToggleAllButtonState();
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
    updateEditorToggleAllButtonState();
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                    </button>
                </div>
                <h3>שאלה ${index + 1}</h3>
            </div>
            <div class="header-right">
                <button type="button" class="btn-icon preview-question-btn" title="תצוגת שאלה">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34-3-3-1.34-3-3-3z"/></svg>
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
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24 5-5s2.24 5 5 5h4v-2zm-3-4h8v2H8v-2z"/></svg>
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
        if (!e.target.closest('button')) {
            card.classList.contains('collapsed') ? expandCard(card) : collapseCard(card);
        }
    });

    card.querySelector('.preview-question-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const q = card.querySelector('.question-input').value;
        const a = card.querySelector('.answer-input').value;
        showQuestionPreview(q, a);
    });

    card.querySelector('.delete-question-btn').addEventListener('click', (e) => {
        const cardToDelete = e.currentTarget.closest('.question-card');
        
        cardToDelete.classList.add('deleting');
        setUnsavedState(true);
    
        cardToDelete.addEventListener('animationend', () => {
            cardToDelete.remove();
            renumberQuestionCards();
            updateReorderButtons();
            updateEditorToggleAllButtonState();
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
            gameEditorForm.scrollBy({ top: scrollDelta, behavior: 'auto' });
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
            gameEditorForm.scrollBy({ top: scrollDelta, behavior: 'auto' });
            renumberQuestionCards();
            updateReorderButtons();
            setUnsavedState(true);
        }
    });
    
    // Set initial state for preview button on render
    const urlInput = card.querySelector('.url-input');
    const previewBtn = card.querySelector('.preview-link-btn');
    if (urlInput && previewBtn) {
        previewBtn.disabled = !urlInput.value.trim() || !urlInput.checkValidity();
    }

    updateCollapsedTitle(card);
    return card;
}

/**
 * Renders all questions for the currently loaded game into the editor.
 * @param {Array<object>} questions - An array of question objects.
 */
function renderAllQuestionsForEditor(questions) {
    questionsEditorContainer.innerHTML = '';
    questions.forEach((q, i) => {
        const card = renderQuestionCard(q, i);
        questionsEditorContainer.appendChild(card);
    });
    updateReorderButtons();
    updateEditorToggleAllButtonState();
}

/**
 * Renders the read-only question list for the view panel.
 * @param {object} gameData - The parsed game data object.
 */
function renderReadOnlyQuestions(gameData) {
    viewQuestionsList.innerHTML = '';
    const questions = gameData.questions || [];

    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'view-question-item';
        item.innerHTML = `
            <div class="view-question-header" role="button" tabindex="0" aria-expanded="false">
                <p><strong>שאלה ${index + 1}:</strong> ${truncateText(q.q, 8)}</p>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
            </div>
            <div class="view-question-body">
                <p>${q.q}</p>
                <p class="view-question-answer">${q.a}</p>
            </div>
        `;
        viewQuestionsList.appendChild(item);
    });

    if (gameData.final_question && gameData.final_question.q) {
        const item = document.createElement('div');
        item.className = 'view-question-item';
        item.innerHTML = `
            <div class="view-question-header" role="button" tabindex="0" aria-expanded="false">
                <p><strong>שאלת הסיכום:</strong> ${truncateText(gameData.final_question.q, 8)}</p>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
            </div>
            <div class="view-question-body">
                <p>${gameData.final_question.q}</p>
                <p class="view-question-answer">${gameData.final_question.a}</p>
            </div>
        `;
        viewQuestionsList.appendChild(item);
    }
}


/**
 * Fetches and loads a game's data into the new view panel.
 * @param {object} gameDocument - The game document from Appwrite.
 */
async function loadGameForViewing(gameDocument) {
    currentlySelectedGameDoc = gameDocument;

    if (!gameDocument) {
        editorPlaceholder.classList.remove('hidden');
        gameViewPanel.classList.add('hidden');
        editorContainer.classList.add('hidden');
        continueViewPanel.classList.add('hidden');
        setUnsavedState(false);
        return;
    }
    
    try {
        const gameData = JSON.parse(gameDocument.game_data);
        
        // Populate View Panel
        viewGameName.textContent = gameDocument.game_name || '';
        viewGameDescription.textContent = gameDocument.description || 'אין תיאור למשחק זה.';
        const category = allCategories.find(c => c.$id === gameDocument.categoryId);
        viewGameCategory.textContent = category ? category.name : 'לא משויך';
        viewGameStatus.textContent = gameDocument.is_public ? 'ציבורי' : 'פרטי';
        viewGameQCount.textContent = gameData.questions.length;
        renderReadOnlyQuestions(gameData);

        // Reset question visibility state
        document.getElementById('view-questions-list').classList.add('hidden');
        viewToggleQuestionsBtn.textContent = 'הצג שאלות';
        viewToggleAllQuestionsBtn.classList.add('hidden');


        // Set Button Visibility
        const isOwned = gameDocument.isOwned;
        viewEditBtn.classList.toggle('hidden', !isOwned);
        viewDeleteBtn.classList.toggle('hidden', !isOwned);

        // Show/Hide Panels
        editorPlaceholder.classList.add('hidden');
        editorContainer.classList.add('hidden');
        continueViewPanel.classList.add('hidden');
        gameViewPanel.classList.remove('hidden');

        setUnsavedState(false);

    } catch (error) {
        console.error(`Failed to parse game data for ${gameDocument.game_name}:`, error);
        showNotification(`שגיאה בפענוח נתוני המשחק.`, 'error');
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
            
            if (!game.isOwned) {
                const publicIconSVG = `<svg class="public-game-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF" title="משחק ציבורי"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`;
                content = publicIconSVG + content;
            }
            
            li.innerHTML = content;
            gameListUl.appendChild(li);
        });
    } catch (error) {
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
        allCategories = await listCategories();
        if (allCategories.length === 0) {
            selectors.forEach(sel => {
                const option = document.createElement('option');
                option.textContent = 'לא נמצאו קטגוריות';
                option.disabled = true;
                sel.appendChild(option);
            });
            return;
        }

        allCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.$id;
            option.textContent = category.name;
            gameCategorySelect.appendChild(option);
            newGameCategorySelect.appendChild(option.cloneNode(true));
        });

    } catch (error) {
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
function renderCategories() {
    categoryListContainer.innerHTML = '<span>טוען קטגוריות...</span>';
    
    try {
        categoryListContainer.innerHTML = '';

        const allCard = document.createElement('div');
        allCard.className = 'category-card selected';
        allCard.dataset.categoryId = 'all';
        allCard.innerHTML = `<img src="https://img.icons8.com/plasticine/100/question-mark.png" alt="הכל"><span>הכל</span>`;
        categoryListContainer.appendChild(allCard);

        allCategories.forEach(category => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.categoryId = category.$id;
            const imageUrl = category.imageId ? getFileUrl(category.imageId) : 'https://img.icons8.com/plasticine/100/folder-invoices.png';
            card.innerHTML = `<img src="${imageUrl}" alt="${category.name}"><span>${category.name}</span>`;
            categoryListContainer.appendChild(card);
        });

    } catch (error) {
        categoryListContainer.innerHTML = '<span>שגיאה בטעינת קטגוריות</span>';
    }
}

/**
 * Checks for a saved game state and updates the "Continue" checkbox accordingly.
 */
function refreshContinueToggleState() {
    const continueCheckbox = document.getElementById('continue-last-point');
    const continueLabel = document.querySelector('label[for="continue-last-point"]');
    const savedState = getSavedState();

    // Check if game is finished (winner announced)
    const isFinished = savedState && savedState.gameStateForParticipant === 'winnerAnnouncement';

    if (savedState && savedState.gameName && !isFinished) {
        continueCheckbox.disabled = false;
        continueLabel.textContent = `המשך "${savedState.gameName}"`;
    } else {
        continueCheckbox.disabled = true;
        continueLabel.textContent = 'המשך מנקודה אחרונה';
        
        // Clear state if it exists but is finished or corrupt
        if (savedState) { 
            resetState();
        }
    }
    continueCheckbox.checked = false;
    // Manually trigger change event to reset UI state if it was somehow checked
    continueCheckbox.dispatchEvent(new Event('change'));
}


/**
 * Shows the main edit screen and populates the game list.
 */
export async function showEditScreen() {
    editGameScreen.classList.remove('hidden');
    document.getElementById('global-home-btn').classList.remove('hidden');
    loadGameForViewing(null);
    
    // Ensure categories are fetched before they are rendered to fix race condition
    await populateCategorySelectors();
    renderCategories(); // This function is synchronous and uses the data from the previous call
    
    await populateGameList(null);
    refreshContinueToggleState();
}

/**
 * The logic for saving the game, extracted into a reusable async function.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on failure.
 */
async function handleSave() {
    const documentId = currentlySelectedGameDoc?.$id;
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
        const updatedDoc = await updateGame(documentId, gameName, description, categoryId, gameData, isPublic);
        showSavedState();
        showNotification('המשחק נשמר בהצלחה!', 'success');
        
        // Refresh the local cache and UI
        const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
        await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
        const liToSelect = gameListUl.querySelector(`li[data-document-id="${documentId}"]`);
        if(liToSelect) liToSelect.classList.add('selected');
        
        // After save, go back to view mode with updated data
        editorContainer.classList.add('hidden');
        loadGameForViewing(gameDocumentsCache[documentId]);

        return true;
    } catch (e) {
        toolbarSaveBtn.disabled = false;
        return false;
    }
}


/**
 * A central handler for actions that might discard unsaved changes.
 * @param {function} actionCallback The function to execute if the user decides to proceed.
 */
export async function checkForUnsavedChangesAndProceed(actionCallback) {
    const isUnsaved = toolbarSaveBtn.classList.contains('unsaved');

    if (!isUnsaved || userAcknowledgedUnsavedChanges) {
        if (actionCallback) await actionCallback();
        return;
    }

    const result = await showConfirmModal('יש לך שינויים שלא נשמרו. מה ברצונך לעשות?', 'save_flow');

    switch (result) {
        case 'save':
            const wasSaveSuccessful = await handleSave();
            if (wasSaveSuccessful && actionCallback) {
                await actionCallback();
            }
            break;
        case 'dont_save':
            userAcknowledgedUnsavedChanges = true;
            if (actionCallback) await actionCallback();
            break;
        case 'cancel':
        case false:
        default:
            // Do nothing, user stays on the page.
            break;
    }
}

/**
 * Initializes all event listeners for the edit game screen.
 * @param {function} onStart - The callback function to start the game.
 */
export function initializeEditGameScreen(onStart) {
    onStartGameCallback = onStart;

    // --- Final Question Auto-Resize ---
    [finalQuestionQInput, finalQuestionAInput].forEach(textarea => {
        if(textarea) {
            textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        }
    });

    categoryListContainer.addEventListener('click', (e) => {
        const selectedCard = e.target.closest('.category-card');
        if (!selectedCard || selectedCard.classList.contains('selected')) return;

        const proceed = () => {
            categoryListContainer.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
            selectedCard.classList.add('selected');
            const categoryId = selectedCard.dataset.categoryId;
            populateGameList(categoryId === 'all' ? null : categoryId);
            loadGameForViewing(null);
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
            loadGameForViewing(gameDoc);
        };
        checkForUnsavedChangesAndProceed(proceed);
    });

    viewPlayBtn.addEventListener('click', () => {
        const proceed = async () => {
            if (!currentlySelectedGameDoc) return;
            editGameScreen.classList.add('hidden');
            document.getElementById('global-header').classList.add('hidden');
            await showSetupScreenForGame(currentlySelectedGameDoc);
        };
        checkForUnsavedChangesAndProceed(proceed);
    });
    
    viewEditBtn.addEventListener('click', () => {
        if (!currentlySelectedGameDoc) return;
        
        try {
            const gameData = JSON.parse(currentlySelectedGameDoc.game_data);
            
            // Populate Editor Form
            gameNameInput.value = currentlySelectedGameDoc.game_name || '';
            gameDescriptionInput.value = currentlySelectedGameDoc.description || '';
            gameCategorySelect.value = currentlySelectedGameDoc.categoryId || '';
            gamePublicCheckbox.checked = currentlySelectedGameDoc.is_public || false;

            renderAllQuestionsForEditor(gameData.questions);
            
            if (gameData.final_question) {
                finalQuestionQInput.value = gameData.final_question.q || '';
                finalQuestionAInput.value = gameData.final_question.a || '';
                finalQuestionUrlInput.value = gameData.final_question.url || '';
            } else {
                finalQuestionQInput.value = '';
                finalQuestionAInput.value = '';
                finalQuestionUrlInput.value = '';
            }

            // Resize final question textareas
            [finalQuestionQInput, finalQuestionAInput].forEach(el => {
                 setTimeout(() => autoResizeTextarea(el), 0);
            });

            // Set initial state for preview button in final question
            const finalPreviewBtn = document.getElementById('final-question-preview-btn');
            if(finalPreviewBtn) {
                finalPreviewBtn.disabled = !finalQuestionUrlInput.value.trim() || !finalQuestionUrlInput.checkValidity();
            }

            // Switch views
            gameViewPanel.classList.add('hidden');
            editorContainer.classList.remove('hidden');
            setUnsavedState(false); // Start in a clean state
            gameNameInput.focus();

        } catch(error) {
            showNotification('שגיאה בטעינת נתוני המשחק לעריכה.', 'error');
        }
    });

    toolbarCancelBtn.addEventListener('click', () => {
        const proceed = () => {
            editorContainer.classList.add('hidden');
            gameViewPanel.classList.remove('hidden');
            setUnsavedState(false); // Discard unsaved state
        };
        checkForUnsavedChangesAndProceed(proceed);
    });


    createNewGameBtn.addEventListener('click', () => {
        const proceed = () => {
            // Clear modal fields before showing
            newGameNameInput.value = '';
            newGameDescriptionInput.value = '';
            newGamePublicCheckbox.checked = false; // Default to private
            gameDataToDuplicate = null; // Ensure no data is carried over from a duplication attempt

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

    viewToggleQuestionsBtn.addEventListener('click', () => {
        const list = document.getElementById('view-questions-list');
        const isHidden = list.classList.contains('hidden');
        list.classList.toggle('hidden', !isHidden);
        viewToggleQuestionsBtn.textContent = isHidden ? 'הסתר שאלות' : 'הצג שאלות';
        
        viewToggleAllQuestionsBtn.classList.toggle('hidden', !isHidden);
        
        if (isHidden) {
            list.querySelectorAll('.view-question-item.open').forEach(item => {
                item.classList.remove('open');
                const header = item.querySelector('.view-question-header');
                if (header) header.setAttribute('aria-expanded', 'false');
            });
            updateViewToggleAllButtonState();
        }
    });


    // --- Link Preview Listeners ---
    editorContainer.addEventListener('input', (e) => {
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
        const questionCount = questionsEditorContainer.children.length;
        const newCard = renderQuestionCard({ q: '', a: '', timer: 30, url: '' }, questionCount);
        questionsEditorContainer.appendChild(newCard);
    
        updateReorderButtons();
        updateEditorToggleAllButtonState();
        setUnsavedState(true);
    
        expandCard(newCard);
        newCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
        const questionInput = newCard.querySelector('.question-input');
        if (questionInput) {
            questionInput.focus({ preventScroll: true });
        }
    });

    toolbarSaveBtn.addEventListener('click', handleSave);

    viewDeleteBtn.addEventListener('click', async () => {
        if (!currentlySelectedGameDoc) return;
        const gameName = currentlySelectedGameDoc.game_name;
        const result = await showConfirmModal(`האם אתה בטוח שברצונך למחוק את המשחק "${gameName}"? פעולה זו אינה הפיכה.`);
        
        if (result) {
            try {
                await deleteGame(currentlySelectedGameDoc.$id);
                showNotification(`המשחק "${gameName}" נמחק בהצלחה.`, 'success');
                
                // Refresh UI
                const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
                await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
                loadGameForViewing(null); // Clear the view panel
            } catch (error) {
                // The service function already shows a notification
            }
        }
    });
    
    viewDuplicateBtn.addEventListener('click', () => {
        if (!currentlySelectedGameDoc) return;

        const proceed = () => {
            try {
                gameDataToDuplicate = JSON.parse(currentlySelectedGameDoc.game_data);
                newGameNameInput.value = `עותק של ${currentlySelectedGameDoc.game_name}`;
                newGameDescriptionInput.value = currentlySelectedGameDoc.description || '';
                newGameCategorySelect.value = currentlySelectedGameDoc.categoryId || '';
                newGamePublicCheckbox.checked = currentlySelectedGameDoc.is_public || false;

                newGameModalOverlay.classList.remove('hidden');
                newGameNameInput.focus();
            } catch(e) {
                showNotification('שגיאה בהכנת המשחק לשכפול.', 'error');
                gameDataToDuplicate = null;
            }
        };

        checkForUnsavedChangesAndProceed(proceed);
    });
    
    // --- New Game Modal Logic ---
    closeNewGameModalBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.add('hidden');
        gameDataToDuplicate = null;
    });

    newGameModalOverlay.addEventListener('click', (e) => {
        if (e.target === newGameModalOverlay) {
            newGameModalOverlay.classList.add('hidden');
            gameDataToDuplicate = null;
        }
    });

    confirmNewGameBtn.addEventListener('click', async () => {
        const name = newGameNameInput.value.trim();
        const description = newGameDescriptionInput.value.trim();
        const categoryId = newGameCategorySelect.value;
        const isPublic = newGamePublicCheckbox.checked;

        if (!name) {
            showNotification('יש להזין שם למשחק.', 'error');
            return;
        }

        try {
            const gameData = gameDataToDuplicate || { questions: [], final_question: { q: '', a: '' } };
            const newDoc = await createGame(name, description, categoryId, gameData, isPublic);
            
            showNotification('המשחק נוצר בהצלחה!', 'success');
            newGameModalOverlay.classList.add('hidden');
            
            // Refresh game list and select the new game
            const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
            await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
            
            const liToSelect = gameListUl.querySelector(`li[data-document-id="${newDoc.$id}"]`);
            if (liToSelect) {
                liToSelect.click();
            } else {
                // If the new game is in a different category, we may need to switch
                loadGameForViewing(null);
            }

        } catch (error) {
            // Service function shows a notification
        } finally {
            gameDataToDuplicate = null;
        }
    });

    // --- Continue Game Logic ---
    const continueCheckbox = document.getElementById('continue-last-point');
    const continueGameBtn = document.getElementById('continue-game-btn');
    const continueGameName = document.getElementById('continue-game-name');

    continueCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const savedState = getSavedState();

        const listsToDisable = [categoryListContainer, gameListUl];
        listsToDisable.forEach(el => {
            el.style.pointerEvents = isChecked ? 'none' : 'auto';
            el.style.opacity = isChecked ? 0.5 : 1;
        });

        if (isChecked && savedState) {
            editorPlaceholder.classList.add('hidden');
            gameViewPanel.classList.add('hidden');
            editorContainer.classList.add('hidden');
            continueViewPanel.classList.remove('hidden');
            continueGameName.textContent = `משחק: ${savedState.gameName}`;
            continueGameBtn.focus();
        } else {
            continueViewPanel.classList.add('hidden');
            // Restore appropriate view (placeholder or selected game)
            if (currentlySelectedGameDoc) {
                gameViewPanel.classList.remove('hidden');
            } else {
                editorPlaceholder.classList.remove('hidden');
            }
        }
    });

    continueGameBtn.addEventListener('click', () => {
        if (onStartGameCallback) {
            editGameScreen.classList.add('hidden');
            document.getElementById('global-header').classList.add('hidden');
            onStartGameCallback({ continueLastPoint: true });
        }
    });

    // --- Question Toggling in Editor ---
    toggleAllQuestionsBtn.addEventListener('click', () => {
        const cards = questionsEditorContainer.querySelectorAll('.question-card');
        const isExpanding = toggleAllQuestionsBtn.classList.contains('state-expand');
        cards.forEach(card => isExpanding ? expandCard(card) : collapseCard(card));
        updateEditorToggleAllButtonState();
    });
    
    // --- Question Toggling in View ---
    viewQuestionsList.addEventListener('click', (e) => {
        const header = e.target.closest('.view-question-header');
        if (header) {
            const item = header.parentElement;
            const isOpening = !item.classList.contains('open');
            item.classList.toggle('open');
            header.setAttribute('aria-expanded', isOpening);
            updateViewToggleAllButtonState();
        }
    });
    
    viewToggleAllQuestionsBtn.addEventListener('click', () => {
        const items = viewQuestionsList.querySelectorAll('.view-question-item');
        const isExpanding = viewToggleAllQuestionsBtn.classList.contains('state-expand');
        
        items.forEach(item => {
            const header = item.querySelector('.view-question-header');
            item.classList.toggle('open', isExpanding);
            if (header) {
                header.setAttribute('aria-expanded', isExpanding);
            }
        });
        
        updateViewToggleAllButtonState();
    });
}