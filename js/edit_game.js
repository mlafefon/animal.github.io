import {
    getMyGames,
    saveGame,
    createGame,
    deleteGame
} from './auth.js';


// --- Elements ---
const editGameScreen = document.getElementById('edit-game-screen');
const startScreen = document.getElementById('start-screen');
const gameEditorSelect = document.getElementById('game-editor-select');
const createNewGameBtn = document.getElementById('create-new-game-btn');
const uploadGameBtn = document.getElementById('upload-game-btn');
const uploadGameInput = document.getElementById('upload-game-input');
const gameEditorForm = document.getElementById('game-editor-form');
const gameNameInput = document.getElementById('game-name-input');
const questionsEditorContainer = document.getElementById('questions-editor-container');
const addQuestionBtn = document.getElementById('add-question-btn');
const saveGameBtn = document.getElementById('save-game-btn');
const downloadGameBtn = document.getElementById('download-game-btn');
const finalQuestionQInput = document.getElementById('final-question-q-input');
const finalQuestionAInput = document.getElementById('final-question-a-input');
const toggleAllQuestionsBtn = document.getElementById('toggle-all-questions-btn');
const deleteGameBtn = document.getElementById('delete-game-btn');
const publicGameToggle = document.getElementById('public-game-toggle');

// Modal Elements
const newGameModalOverlay = document.getElementById('new-game-modal-overlay');
const newGameNameInput = document.getElementById('new-game-name');
const confirmNewGameBtn = document.getElementById('confirm-new-game-btn');
const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');


// --- State Management for Save Button ---
let saveStateTimeout = null;
let gamesCache = {}; // Cache for currently loaded games in the editor

/**
 * Validates if the provided data object conforms to the game data schema.
 * @param {object} data - The parsed JSON data from the uploaded file.
 * @returns {string|null} An error message string if invalid, or null if valid.
 */
function getGameDataValidationError(data) {
    if (!data || typeof data !== 'object') {
        return 'הקובץ אינו מכיל אובייקט JSON תקין.';
    }

    if (typeof data.game_name !== 'string' || data.game_name.trim() === '') {
        return 'שדה "game_name" חסר או ריק.';
    }

    if (!Array.isArray(data.questions)) {
        return 'שדה "questions" חסר או שאינו מערך (array).';
    }

    for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
         if (typeof q !== 'object' || q === null) {
            return `שאלה מספר ${i + 1} אינה אובייקט תקין.`;
        }
        if (typeof q.q !== 'string' || q.q.trim() === '') {
            return `שאלה מספר ${i + 1} חסרה את שדה "q" או שהוא ריק.`;
        }
        if (typeof q.a !== 'string' || q.a.trim() === '') {
            return `שאלה מספר ${i + 1} חסרה את שדה "a" או שהוא ריק.`;
        }
        if (typeof q.timer !== 'number' || !Number.isInteger(q.timer) || q.timer <= 0) {
            return `שאלה מספר ${i + 1} חסרה את שדה "timer" או שהוא אינו מספר חיובי שלם.`;
        }
    }

    if (data.hasOwnProperty('final_question') && data.final_question !== null) {
        if (typeof data.final_question !== 'object') {
            return 'השדה "final_question" אינו אובייקט תקין.';
        }
        const fq = data.final_question;
        if (typeof fq.q !== 'string' || fq.q.trim() === '') {
            return 'שאלת הסיכום חסרה את שדה "q" או שהוא ריק.';
        }
        if (typeof fq.a !== 'string' || fq.a.trim() === '') {
            return 'שאלת הסיכום חסרה את שדה "a" או שהוא ריק.';
        }
    }

    return null; // Data is valid
}


/**
 * Sets the visual state of the save button to indicate unsaved changes.
 * @param {boolean} isUnsaved - True to show unsaved state, false to reset.
 */
function setUnsavedState(isUnsaved) {
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
        saveGameBtn.textContent = 'שמור שינויים';
        saveGameBtn.classList.remove('saved');
        saveGameBtn.disabled = false;
        saveStateTimeout = null;
    }

    if (isUnsaved) {
        saveGameBtn.classList.add('unsaved');
    } else {
        saveGameBtn.classList.remove('unsaved');
    }
}

function showSavedState() {
    setUnsavedState(false);
    saveGameBtn.classList.add('saved');
    saveGameBtn.textContent = 'נשמר!';
    saveGameBtn.disabled = true;

    saveStateTimeout = setTimeout(() => {
        saveGameBtn.classList.remove('saved');
        saveGameBtn.textContent = 'שמור שינויים';
        saveGameBtn.disabled = false;
        saveStateTimeout = null;
    }, 2000);
}

function setMainActionButtonsVisibility(visible) {
    const mainEditActions = document.querySelector('.main-edit-actions');
    if (mainEditActions) {
        mainEditActions.classList.toggle('hidden', !visible);
    }
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

function truncateText(text, limit = 6) {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length > limit) {
        return words.slice(0, limit).join(' ') + '...';
    }
    return text;
}

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


function updateCollapsedTitle(card) {
    const titleEl = card.querySelector('h3');
    const index = parseInt(card.dataset.index, 10);
    const questionText = card.querySelector('.question-input').value.trim();
    const truncated = truncateText(questionText);
    titleEl.innerHTML = `<span class="question-title-number">שאלה ${index + 1}:</span><span class="question-title-preview">${truncated}</span>`;
    titleEl.title = questionText;
}

function collapseCard(card) {
    card.classList.add('collapsed');
    updateCollapsedTitle(card);
    updateToggleAllButtonState();
}

function expandCard(card) {
    card.classList.remove('collapsed');
    const titleEl = card.querySelector('h3');
    const index = parseInt(card.dataset.index, 10);
    titleEl.textContent = `שאלה ${index + 1}`;
    titleEl.title = '';
    updateToggleAllButtonState();
}


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

function updateReorderButtons() {
    const cards = questionsEditorContainer.querySelectorAll('.question-card');
    cards.forEach((card, index) => {
        const upBtn = card.querySelector('.reorder-up-btn');
        const downBtn = card.querySelector('.reorder-down-btn');
        
        if (upBtn) upBtn.disabled = (index === 0);
        if (downBtn) downBtn.disabled = (index === cards.length - 1);
    });
}

function renderQuestionCard(question, index) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.index = index;

    card.innerHTML = `
        <div class="question-card-header">
            <div class="header-left">
                <div class="reorder-controls">
                    <button type="button" class="reorder-btn reorder-up-btn" title="העבר למעלה">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg>
                    </button>
                    <button type="button" class="reorder-btn reorder-down-btn" title="העבר למטה">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6 6 1.41-1.41z"/></svg>
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
            if (card.classList.contains('collapsed')) {
                expandCard(card);
            } else {
                collapseCard(card);
            }
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
            
            editGameScreen.scrollBy({ top: scrollDelta, behavior: 'auto' });

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

            editGameScreen.scrollBy({ top: scrollDelta, behavior: 'auto' });
            
            renumberQuestionCards();
            updateReorderButtons();
            setUnsavedState(true);
        }
    });

    questionsEditorContainer.appendChild(card);
    return card;
}

function renderAllQuestions(questions = []) {
    questionsEditorContainer.innerHTML = '';
    questions.forEach(renderQuestionCard);
    updateReorderButtons();
    updateToggleAllButtonState();
}

async function loadGameForEditing(gameId) {
    if (!gameId) {
        gameEditorForm.classList.add('hidden');
        setUnsavedState(false);
        setMainActionButtonsVisibility(false);
        return;
    }
    try {
        const gameDoc = gamesCache[gameId];
        if (!gameDoc) throw new Error("Game not found in cache");
        
        const gameData = gameDoc.content;

        gameNameInput.value = gameData.game_name || '';
        renderAllQuestions(gameData.questions);
        
        if (gameData.final_question) {
            finalQuestionQInput.value = gameData.final_question.q || '';
            finalQuestionAInput.value = gameData.final_question.a || '';
        } else {
            finalQuestionQInput.value = '';
            finalQuestionAInput.value = '';
        }
        
        publicGameToggle.checked = gameDoc.isPublic;

        setTimeout(() => {
            autoResizeTextarea(finalQuestionQInput);
            autoResizeTextarea(finalQuestionAInput);
        }, 0);

        gameEditorForm.dataset.currentGameId = gameId;
        gameEditorForm.classList.remove('hidden');
        setUnsavedState(false);
        setMainActionButtonsVisibility(true);
    } catch (error) {
        console.error(`Failed to load game data for ${gameId}:`, error);
        alert(`שגיאה בטעינת המשחק.`);
        setMainActionButtonsVisibility(false);
    }
}

async function populateGameSelector() {
    while (gameEditorSelect.options.length > 1) {
        gameEditorSelect.remove(1);
    }
    gamesCache = {};

    try {
        const games = await getMyGames(); // Fetch user's own games
        if (games.length === 0) {
            gameEditorSelect.querySelector('option').textContent = "-- אין לך משחקים, צור אחד חדש! --";
            return;
        }

        gameEditorSelect.querySelector('option').textContent = "-- בחר משחק לעריכה --";
        games.forEach(game => {
            gamesCache[game.$id] = game; // Cache the full document
            const option = document.createElement('option');
            option.value = game.$id;
            option.textContent = game.name;
            gameEditorSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Failed to populate game selector:', error);
        const option = document.createElement('option');
        option.textContent = 'שגיאה בטעינת משחקים';
        option.disabled = true;
        gameEditorSelect.appendChild(option);
    }
}

function compileGameData() {
    const gameName = gameNameInput.value.trim();
    if (!gameName) {
        alert('יש להזין שם למשחק.');
        return null;
    }

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


    return {
        game_name: gameName,
        questions: questions,
        final_question: final_question
    };
}

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


export function showEditScreen() {
    editGameScreen.classList.remove('hidden');
    gameEditorForm.classList.add('hidden');
    gameEditorSelect.value = '';
    document.getElementById('global-home-btn').classList.remove('hidden');
    delete gameEditorForm.dataset.currentGameId;
    populateGameSelector();
    setMainActionButtonsVisibility(false);
}

export function initializeEditGameScreen() {
    const backToHomeBtn = document.getElementById('back-to-home-from-edit-btn');

    backToHomeBtn.addEventListener('click', () => {
        editGameScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
        const globalHomeBtn = document.getElementById('global-home-btn');
        if (globalHomeBtn) {
            globalHomeBtn.classList.add('hidden');
        }
    });

    gameEditorSelect.addEventListener('change', () => {
        loadGameForEditing(gameEditorSelect.value);
    });

    uploadGameBtn.addEventListener('click', () => uploadGameInput.click());

    uploadGameInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const gameData = JSON.parse(e.target.result);
                
                const validationError = getGameDataValidationError(gameData);
                if (validationError) {
                    alert(`הקובץ שהועלה אינו תקין.\nסיבה: ${validationError}`);
                    return;
                }

                const newGame = await createGame(gameData);
                alert(`המשחק "${gameData.game_name}" נוצר בהצלחה.`);
                
                await populateGameSelector();
                gameEditorSelect.value = newGame.$id;
                await loadGameForEditing(newGame.$id);

            } catch (error) {
                console.error("Error processing uploaded game file:", error);
                alert('הקובץ אינו קובץ JSON תקין או שחלה שגיאה בעיבודו.');
            } finally {
                uploadGameInput.value = '';
            }
        };
        reader.onerror = () => alert('שגיאה בקריאת הקובץ.');
        reader.readAsText(file);
    });

    gameEditorForm.addEventListener('input', () => setUnsavedState(true));

    addQuestionBtn.addEventListener('click', () => {
        const questionCount = questionsEditorContainer.children.length;
        const newCard = renderQuestionCard({ q: '', a: '', timer: 30 }, questionCount);
        updateReorderButtons();
        updateToggleAllButtonState();
        setUnsavedState(true);

        if (newCard) {
            newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const firstInput = newCard.querySelector('.question-input');
            if (firstInput) setTimeout(() => firstInput.focus(), 400); 
        }
    });

    saveGameBtn.addEventListener('click', async () => {
        const gameData = compileGameData();
        const gameId = gameEditorForm.dataset.currentGameId;

        if (!gameId) {
            alert('לא נבחר משחק לשמירה.');
            return;
        }
        
        if (gameData) {
            try {
                const isPublic = publicGameToggle.checked;
                await saveGame(gameId, gameData, isPublic);
                showSavedState();
                
                const currentlySelected = gameEditorSelect.value;
                await populateGameSelector();
                gameEditorSelect.value = currentlySelected;
    
            } catch (e) {
                console.error("Error saving game", e);
                alert("שגיאה בשמירת המשחק.");
            }
        }
    });

    downloadGameBtn.addEventListener('click', () => {
        const gameData = compileGameData();
        const gameId = gameEditorForm.dataset.currentGameId;

        if (!gameId) {
            alert('לא נבחר משחק להורדה.');
            return;
        }

        if (gameData) {
            const fileName = `${gameData.game_name.replace(/\s+/g, '_')}.json`;
            downloadJsonFile(fileName, gameData);
        }
    });

    deleteGameBtn.addEventListener('click', async () => {
        const gameId = gameEditorForm.dataset.currentGameId;
        if (!gameId) return;

        const gameName = gamesCache[gameId]?.name || "המשחק הנבחר";
        if (confirm(`האם אתה בטוח שברצונך למחוק את המשחק "${gameName}"?`)) {
            try {
                await deleteGame(gameId);
                alert("המשחק נמחק בהצלחה.");
                gameEditorForm.classList.add('hidden');
                setMainActionButtonsVisibility(false);
                await populateGameSelector();
            } catch (error) {
                console.error("Failed to delete game:", error);
                alert("המחיקה נכשלה.");
            }
        }
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
        if (!newName) {
            alert('יש למלא את שם המשחק.');
            return;
        }
        
        const newGameData = {
            game_name: newName,
            questions: [],
            final_question: { q: "", a: "" }
        };
    
        try {
            const newGame = await createGame(newGameData);
            
            newGameModalOverlay.classList.add('hidden');
            newGameNameInput.value = '';
    
            await populateGameSelector();
            gameEditorSelect.value = newGame.$id;
            await loadGameForEditing(newGame.$id);
    
            alert(`משחק חדש "${newName}" נוצר. כעת ניתן לערוך אותו.`);
    
        } catch(e) {
            console.error("Error creating new game:", e);
            alert("שגיאה ביצירת המשחק החדש.");
        }
    });
    
    finalQuestionQInput.addEventListener('input', () => autoResizeTextarea(finalQuestionQInput));
    finalQuestionAInput.addEventListener('input', () => autoResizeTextarea(finalQuestionAInput));
}