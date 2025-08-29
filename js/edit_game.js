// --- Elements ---
const editGameScreen = document.getElementById('edit-game-screen');
const startScreen = document.getElementById('start-screen');
const returnToStartBtn = document.getElementById('return-to-start-btn');
const gameEditorSelect = document.getElementById('game-editor-select');
const createNewGameBtn = document.getElementById('create-new-game-btn');
const gameEditorForm = document.getElementById('game-editor-form');
const gameNameInput = document.getElementById('game-name-input');
const questionsEditorContainer = document.getElementById('questions-editor-container');
const addQuestionBtn = document.getElementById('add-question-btn');
const saveGameBtn = document.getElementById('save-game-btn');
const finalQuestionQInput = document.getElementById('final-question-q-input');
const finalQuestionAInput = document.getElementById('final-question-a-input');

// Modal Elements
const newGameModalOverlay = document.getElementById('new-game-modal-overlay');
const newGameNameInput = document.getElementById('new-game-name');
const newGameFilenameInput = document.getElementById('new-game-filename');
const confirmNewGameBtn = document.getElementById('confirm-new-game-btn');
const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');


/**
 * Automatically adjusts the height of a textarea to fit its content.
 * @param {HTMLTextAreaElement} textarea - The textarea element to resize.
 */
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto'; // Reset height to recalculate
    textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * Re-calculates and updates the displayed question number for all cards.
 */
function renumberQuestionCards() {
    const cards = questionsEditorContainer.querySelectorAll('.question-card');
    cards.forEach((card, i) => {
        card.dataset.index = i;
        card.querySelector('h3').textContent = `שאלה ${i + 1}`;
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                    </button>
                </div>
                <h3>שאלה ${index + 1}</h3>
            </div>
            <div class="header-right">
                <button type="button" class="delete-question-btn">מחק</button>
                <svg class="collapse-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
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
        // Set initial size after a tiny delay to ensure rendering is complete
        setTimeout(() => autoResizeTextarea(textarea), 0);
    });

    const header = card.querySelector('.question-card-header');
    header.addEventListener('click', (e) => {
        // Don't toggle if clicking a button
        if (!e.target.closest('button')) {
            card.classList.toggle('collapsed');
        }
    });

    card.querySelector('.delete-question-btn').addEventListener('click', (e) => {
        e.currentTarget.closest('.question-card').remove();
        renumberQuestionCards();
        updateReorderButtons();
    });
    
    // Add listeners for reorder buttons
    const moveUpBtn = card.querySelector('.reorder-up-btn');
    const moveDownBtn = card.querySelector('.reorder-down-btn');

    moveUpBtn.addEventListener('click', (e) => {
        const previousCard = card.previousElementSibling;
        if (previousCard) {
            // Move the element
            questionsEditorContainer.insertBefore(card, previousCard);

            // Adjust scroll so the button stays under the cursor
            const buttonRect = moveUpBtn.getBoundingClientRect();
            const scrollOffset = buttonRect.top - e.clientY;
            editGameScreen.scrollTop += scrollOffset;
            
            // Update UI
            renumberQuestionCards();
            updateReorderButtons();
        }
    });

    moveDownBtn.addEventListener('click', (e) => {
        const nextCard = card.nextElementSibling;
        if (nextCard) {
            // Move the element
            questionsEditorContainer.insertBefore(nextCard, card);
            
            // Adjust scroll so the button stays under the cursor
            const buttonRect = moveDownBtn.getBoundingClientRect();
            const scrollOffset = buttonRect.top - e.clientY;
            editGameScreen.scrollTop += scrollOffset;

            // Update UI
            renumberQuestionCards();
            updateReorderButtons();
        }
    });

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
}

/**
 * Fetches and loads a game's data into the editor form.
 * @param {string} fileName - The JSON file name of the game to load.
 */
async function loadGameForEditing(fileName) {
    if (!fileName) {
        gameEditorForm.classList.add('hidden');
        return;
    }
    try {
        const response = await fetch(`./data/${fileName}`);
        if (!response.ok) throw new Error(`Network response was not ok for ${fileName}`);
        const gameData = await response.json();
        
        gameNameInput.value = gameData.game_name;
        renderAllQuestions(gameData.questions);
        
        // Load the final question
        if (gameData.final_question) {
            finalQuestionQInput.value = gameData.final_question.q || '';
            finalQuestionAInput.value = gameData.final_question.a || '';
        } else {
            finalQuestionQInput.value = '';
            finalQuestionAInput.value = '';
        }

        // Auto-resize final question textareas after loading content
        setTimeout(() => {
            autoResizeTextarea(finalQuestionQInput);
            autoResizeTextarea(finalQuestionAInput);
        }, 0);


        // Store the filename on the form for saving later
        gameEditorForm.dataset.currentFile = fileName;
        gameEditorForm.classList.remove('hidden');
    } catch (error) {
        console.error(`Failed to load game data from ${fileName}:`, error);
        alert(`שגיאה בטעינת המשחק: ${fileName}`);
    }
}

/**
 * Populates the game selection dropdown from a manifest file.
 */
async function populateGameSelector() {
    // Clear existing options except the first placeholder
    while (gameEditorSelect.options.length > 1) {
        gameEditorSelect.remove(1);
    }

    try {
        const manifestResponse = await fetch('./data/manifest.json');
        if (!manifestResponse.ok) {
            throw new Error('Could not load game manifest.');
        }
        const DATA_FILES = await manifestResponse.json();

        const fetchPromises = DATA_FILES.map(async (fileName) => {
            try {
                const response = await fetch(`./data/${fileName}`);
                if (!response.ok) return null;
                const data = await response.json();
                return { name: data.game_name, file: fileName };
            } catch (error) {
                console.error(`Failed to load game name from ${fileName}:`, error);
                return null;
            }
        });
        
        const games = (await Promise.all(fetchPromises)).filter(Boolean);

        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.file;
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

/**
 * Gathers all data from the form and compiles it into a game object.
 * @returns {object|null} The compiled game data object or null if invalid.
 */
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

/**
 * Triggers a browser download for the provided data.
 * @param {string} filename - The name of the file to download.
 * @param {object} data - The JS object to convert to JSON and download.
 */
function downloadJsonFile(filename, data) {
    const jsonString = JSON.stringify(data, null, 4); // Pretty print the JSON
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
 * Shows the main edit screen and populates the game list.
 */
export function showEditScreen() {
    editGameScreen.classList.remove('hidden');
    gameEditorForm.classList.add('hidden');
    gameEditorSelect.value = '';
    delete gameEditorForm.dataset.currentFile; // Clear any previously set filename
    populateGameSelector();
}

/**
 * Initializes all event listeners for the edit game screen.
 */
export function initializeEditGameScreen() {
    returnToStartBtn.addEventListener('click', () => {
        editGameScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
    });

    gameEditorSelect.addEventListener('change', () => {
        loadGameForEditing(gameEditorSelect.value);
    });

    addQuestionBtn.addEventListener('click', () => {
        const questionCount = questionsEditorContainer.children.length;
        renderQuestionCard({ q: '', a: '', timer: 30 }, questionCount);
        updateReorderButtons();
    });

    saveGameBtn.addEventListener('click', () => {
        const gameData = compileGameData();
        const fileName = gameEditorForm.dataset.currentFile;

        if (!fileName) {
            alert('לא נבחר קובץ לשמירה. אנא צור משחק חדש או בחר משחק קיים.');
            return;
        }
        
        if (gameData) {
            downloadJsonFile(fileName, gameData);
            alert(`קובץ המשחק '${fileName}' הורד בהצלחה! יש להעביר אותו לתיקיית 'data' בפרוייקט.`);
        }
    });

    // --- Modal Logic ---
    createNewGameBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.remove('hidden');
    });

    cancelNewGameBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.add('hidden');
    });

    confirmNewGameBtn.addEventListener('click', () => {
        const newName = newGameNameInput.value.trim();
        const newFilename = newGameFilenameInput.value.trim();

        if (!newName || !newFilename) {
            alert('יש למלא את שם המשחק ואת שם הקובץ.');
            return;
        }

        if (!newFilename.endsWith('.json')) {
            alert('שם הקובץ חייב להסתיים ב-.json');
            return;
        }
        
        // Reset and show the form for the new game
        gameEditorSelect.value = ''; // Deselect any chosen game
        gameNameInput.value = newName;
        renderAllQuestions([]); // Start with no questions
        finalQuestionQInput.value = ''; // Clear final question fields
        finalQuestionAInput.value = '';
        gameEditorForm.dataset.currentFile = newFilename; // Set the filename for saving
        gameEditorForm.classList.remove('hidden');

        // Hide modal and clear inputs
        newGameModalOverlay.classList.add('hidden');
        newGameNameInput.value = '';
        newGameFilenameInput.value = '';

        alert(`משחק חדש "${newName}" נוצר. הוסיפו שאלות ולחצו על "שמור שינויים" בסיום.`);
    });
    
    // Add auto-resize listeners for final question textareas
    finalQuestionQInput.addEventListener('input', () => autoResizeTextarea(finalQuestionQInput));
    finalQuestionAInput.addEventListener('input', () => autoResizeTextarea(finalQuestionAInput));
}
