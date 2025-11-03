import { listGames, createGame, updateGame, deleteGame, listCategories, getFileUrl } from './appwriteService.js';
import { showSetupScreenForGame } from './setup.js';

// --- Elements ---
const editGameScreen = document.getElementById('edit-game-screen');
const createNewGameBtn = document.getElementById('create-new-game-btn');
const gameEditorForm = document.getElementById('game-editor-form');
const gameNameInput = document.getElementById('game-name-input');
const gameDescriptionInput = document.getElementById('game-description-input');
const gameCategorySelect = document.getElementById('game-category-select');
const questionsEditorContainer = document.getElementById('questions-editor-container');
const finalQuestionQInput = document.getElementById('final-question-q-input');
const finalQuestionAInput = document.getElementById('final-question-a-input');
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
const confirmNewGameBtn = document.getElementById('confirm-new-game-btn');
const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');


// --- State Management ---
let saveStateTimeout = null;
let gameDocumentsCache = {}; // Cache for all fetched game documents

/**
 * Sets the visual state of the save button to indicate unsaved changes.
 * @param {boolean} isUnsaved - True to show unsaved state, false to reset.
 */
function setUnsavedState(isUnsaved) {
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
        toolbarSaveBtn.title = 'שמור שינויים';
        toolbarSaveBtn.classList.remove('saved');
        toolbarSaveBtn.disabled = false;
        saveStateTimeout = null;
    }

    if (isUnsaved) {
        toolbarSaveBtn.classList.add('unsaved');
    } else {
        toolbarSaveBtn.classList.remove('unsaved');
    }
}

/**
 * Shows a visual confirmation that the game has been saved successfully.
 */
function showSavedState() {
    setUnsavedState(false);
    toolbarSaveBtn.classList.add('saved');
    toolbarSaveBtn.title = 'נשמר!';
    toolbarSaveBtn.disabled = true;

    saveStateTimeout = setTimeout(() => {
        toolbarSaveBtn.classList.remove('saved');
        toolbarSaveBtn.title = 'שמור שינויים';
        toolbarSaveBtn.disabled = false;
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
 * @param {object} question - The question object {q, a, timer}.
 * @param {number} index - The index of the question.
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
                <button type="button" class="delete-question-btn">מחק</button>
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

    card.querySelector('.delete-question-btn').addEventListener('click', (e) => {
        e.currentTarget.closest('.question-card').remove();
        renumberQuestionCards();
        updateReorderButtons();
        updateToggleAllButtonState();
        setUnsavedState(true);
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
    questionsEditorContainer.appendChild(card);
}

/**
 * Clears and renders all questions for the currently loaded game.
 * @param {Array<object>} questions - An array of question objects.
 */
function renderAllQuestions(questions) {
    questionsEditorContainer.innerHTML = '';
    questions.forEach(renderQuestionCard);
    updateReorderButtons();
    updateToggleAllButtonState();
}

/**
 * Fetches and loads a game's data into the editor form from Appwrite.
 * @param {object} gameDocument - The game document from Appwrite.
 */
async function loadGameForEditing(gameDocument) {
    if (!gameDocument) {
        gameEditorForm.classList.add('hidden');
        editorToolbar.classList.add('hidden');
        toolbarDeleteBtn.classList.add('hidden');
        playSelectedGameBtn.disabled = true;
        setUnsavedState(false);
        return;
    }
    try {
        const gameData = JSON.parse(gameDocument.game_data);
        gameNameInput.value = gameDocument.game_name || '';
        gameDescriptionInput.value = gameDocument.description || '';
        gameCategorySelect.value = gameDocument.categoryId || '';
        renderAllQuestions(gameData.questions);
        
        if (gameData.final_question) {
            finalQuestionQInput.value = gameData.final_question.q || '';
            finalQuestionAInput.value = gameData.final_question.a || '';
        } else {
            finalQuestionQInput.value = '';
            finalQuestionAInput.value = '';
        }

        setTimeout(() => {
            autoResizeTextarea(gameDescriptionInput);
            autoResizeTextarea(finalQuestionQInput);
            autoResizeTextarea(finalQuestionAInput);
        }, 0);

        gameEditorForm.dataset.documentId = gameDocument.$id;
        gameEditorForm.classList.remove('hidden');
        editorToolbar.classList.remove('hidden');
        toolbarDeleteBtn.classList.remove('hidden');
        playSelectedGameBtn.disabled = false;
        setUnsavedState(false);
    } catch (error) {
        console.error(`Failed to parse game data for ${gameDocument.game_name}:`, error);
        alert(`שגיאה בפענוח נתוני המשחק: ${gameDocument.game_name}`);
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
            li.textContent = game.game_name;
            li.dataset.documentId = game.$id;
            gameListUl.appendChild(li);
        });
    } catch (error) {
        console.error('Failed to populate game list:', error);
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
        const timer = parseInt(card.querySelector('.timer-input').value, 10);
        if (q && a && !isNaN(timer)) {
            questions.push({ q, a, timer });
        }
    });
    
    const finalQuestionQ = finalQuestionQInput.value.trim();
    const finalQuestionA = finalQuestionAInput.value.trim();
    const final_question = (finalQuestionQ && finalQuestionA)
        ? { q: finalQuestionQ, a: finalQuestionA }
        : null;

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
        console.error("Failed to populate category selectors:", error);
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
        console.error("Failed to render categories:", error);
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
    toolbarDeleteBtn.classList.add('hidden');
    playSelectedGameBtn.disabled = true;
    document.getElementById('global-home-btn').classList.remove('hidden');
    delete gameEditorForm.dataset.documentId;
    
    await Promise.all([
        populateCategorySelectors(),
        renderCategories()
    ]);
    await populateGameList(null);
}

/**
 * Initializes all event listeners for the edit game screen.
 */
export function initializeEditGameScreen() {
    categoryListContainer.addEventListener('click', (e) => {
        const selectedCard = e.target.closest('.category-card');
        if (!selectedCard) return;
        categoryListContainer.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
        selectedCard.classList.add('selected');
        const categoryId = selectedCard.dataset.categoryId;
        populateGameList(categoryId === 'all' ? null : categoryId);
        loadGameForEditing(null);
    });

    gameListUl.addEventListener('click', (e) => {
        const selectedLi = e.target.closest('li');
        if(!selectedLi || !selectedLi.dataset.documentId) return;

        gameListUl.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
        selectedLi.classList.add('selected');

        const gameDoc = gameDocumentsCache[selectedLi.dataset.documentId];
        loadGameForEditing(gameDoc);
    });

    playSelectedGameBtn.addEventListener('click', () => {
        const selectedLi = gameListUl.querySelector('li.selected');
        if(!selectedLi) {
            alert('יש לבחור משחק תחילה.');
            return;
        }
        const gameDoc = gameDocumentsCache[selectedLi.dataset.documentId];
        editGameScreen.classList.add('hidden');
        showSetupScreenForGame(gameDoc);
    });

    gameEditorForm.addEventListener('input', () => setUnsavedState(true));

    toolbarAddQuestionBtn.addEventListener('click', () => {
        if (gameEditorForm.classList.contains('hidden')) {
            alert('יש לבחור משחק לפני הוספת שאלה.');
            return;
        }
        const questionCount = questionsEditorContainer.children.length;
        renderQuestionCard({ q: '', a: '', timer: 30 }, questionCount);
        updateReorderButtons();
        updateToggleAllButtonState();
        setUnsavedState(true);
    });

    toolbarSaveBtn.addEventListener('click', async () => {
        const documentId = gameEditorForm.dataset.documentId;
        if (!documentId) {
            alert('לא נבחר משחק לשמירה.');
            return;
        }
        const gameName = gameNameInput.value.trim();
        if (!gameName) {
            alert('יש להזין שם למשחק.');
            return;
        }
        const description = gameDescriptionInput.value.trim();
        const categoryId = gameCategorySelect.value;
        const gameData = compileGameData();
        
        try {
            await updateGame(documentId, gameName, description, categoryId, gameData);
            showSavedState();
            const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
            await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
            const liToSelect = gameListUl.querySelector(`li[data-document-id="${documentId}"]`);
            if(liToSelect) liToSelect.classList.add('selected');

        } catch (e) {
            console.error("Error saving game to Appwrite", e);
            alert("שגיאה בשמירת המשחק.");
        }
    });

    toolbarDeleteBtn.addEventListener('click', async () => {
        const documentId = gameEditorForm.dataset.documentId;
        const gameName = gameNameInput.value.trim();

        if (!documentId) return;

        if (confirm(`האם אתה בטוח שברצונך למחוק את המשחק "${gameName}"? לא ניתן לשחזר פעולה זו.`)) {
            try {
                await deleteGame(documentId);
                alert(`המשחק "${gameName}" נמחק בהצלחה.`);
                loadGameForEditing(null);
                const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
                await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
            } catch (error) {
                console.error('Failed to delete game:', error);
                alert('מחיקת המשחק נכשלה.');
            }
        }
    });

    toolbarDownloadBtn.addEventListener('click', () => {
        if (gameEditorForm.classList.contains('hidden')) {
            alert('לא נבחר משחק להורדה. אנא בחר משחק קיים.');
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

    createNewGameBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.remove('hidden');
        newGameNameInput.focus();
    });

    cancelNewGameBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.add('hidden');
    });

    confirmNewGameBtn.addEventListener('click', async () => {
        const newName = newGameNameInput.value.trim();
        const newDescription = newGameDescriptionInput.value.trim();
        const newCategoryId = newGameCategorySelect.value;

        if (!newName || !newCategoryId) {
            alert('יש למלא שם וקטגוריה למשחק.');
            return;
        }
        
        const newGameData = { questions: [], final_question: { q: "", a: "" } };
    
        try {
            const newDocument = await createGame(newName, newDescription, newCategoryId, newGameData);
            newGameModalOverlay.classList.add('hidden');
            newGameNameInput.value = '';
            newGameDescriptionInput.value = '';
    
            const currentCategoryId = categoryListContainer.querySelector('.selected')?.dataset.categoryId;
            await populateGameList(currentCategoryId === 'all' ? null : currentCategoryId);
            
            const liToSelect = gameListUl.querySelector(`li[data-document-id="${newDocument.$id}"]`);
            if(liToSelect) liToSelect.click();
    
            alert(`משחק חדש "${newName}" נוצר. כעת ניתן לערוך אותו.`);
        } catch(e) {
            console.error("Error creating new game:", e);
            alert("שגיאה ביצירת המשחק החדש.");
        }
    });
    
    gameDescriptionInput.addEventListener('input', () => autoResizeTextarea(gameDescriptionInput));
    finalQuestionQInput.addEventListener('input', () => autoResizeTextarea(finalQuestionQInput));
    finalQuestionAInput.addEventListener('input', () => autoResizeTextarea(finalQuestionAInput));
    newGameDescriptionInput.addEventListener('input', () => autoResizeTextarea(newGameDescriptionInput));
}