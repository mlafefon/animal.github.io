// --- Elements ---
const editGameScreen = document.getElementById('edit-game-screen');
const startScreen = document.getElementById('start-screen');
const gameEditorSelect = document.getElementById('game-editor-select');
const createNewGameBtn = document.getElementById('create-new-game-btn');
const gameEditorForm = document.getElementById('game-editor-form');
const gameNameInput = document.getElementById('game-name-input');
const questionsEditorContainer = document.getElementById('questions-editor-container');
const addQuestionBtn = document.getElementById('add-question-btn');
const saveGameBtn = document.getElementById('save-game-btn');
const downloadGameBtn = document.getElementById('download-game-btn');
const finalQuestionQInput = document.getElementById('final-question-q-input');
const finalQuestionAInput = document.getElementById('final-question-a-input');
const toggleAllQuestionsBtn = document.getElementById('toggle-all-questions-btn');

// Modal Elements
const newGameModalOverlay = document.getElementById('new-game-modal-overlay');
const newGameNameInput = document.getElementById('new-game-name');
const newGameFilenameInput = document.getElementById('new-game-filename');
const confirmNewGameBtn = document.getElementById('confirm-new-game-btn');
const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');


// --- State Management for Save Button ---
let saveStateTimeout = null;

/**
 * Sets the visual state of the save button to indicate unsaved changes.
 * @param {boolean} isUnsaved - True to show unsaved state, false to reset.
 */
function setUnsavedState(isUnsaved) {
    // Clear any pending "saved" state transitions
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

/**
 * Shows a visual confirmation that the game has been saved successfully.
 */
function showSavedState() {
    setUnsavedState(false); // Remove unsaved state first
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
 * Truncates text to a specific word limit.
 * @param {string} text The text to truncate.
 * @param {number} [limit=6] The word limit.
 * @returns {string} The truncated text.
 */
function truncateText(text, limit = 6) {
    if (!text) return '';
    const words = text.split(/\s+/); // Split by any whitespace
    if (words.length > limit) {
        return words.slice(0, limit).join(' ') + '...';
    }
    return text;
}

/**
 * Updates the state of the toggle-all button based on the current state of the cards.
 * If any card is collapsed, it shows the "Expand" icon.
 * If all cards are expanded, it shows the "Collapse" icon.
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
    titleEl.title = questionText; // Add tooltip with full question
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
    titleEl.title = ''; // Remove tooltip
    updateToggleAllButtonState();
}


/**
 * Re-calculates and updates the displayed question number for all cards.
 */
function renumberQuestionCards() {
    const cards = questionsEditorContainer.querySelectorAll('.question-card');
    cards.forEach((card, i) => {
        card.dataset.index = i;
        // Re-apply the correct title based on collapsed state
        if (card.classList.contains('collapsed')) {
            updateCollapsedTitle(card);
        } else {
            // expandCard would call updateToggleAllButtonState, but this is simpler
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

    // Listener for auto-resizing textareas
    [questionInput, answerInput].forEach(textarea => {
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        // Set initial size after a tiny delay to ensure rendering is complete
        setTimeout(() => autoResizeTextarea(textarea), 0);
    });

    // Listener to update truncated title in real-time
    questionInput.addEventListener('input', () => {
        if (card.classList.contains('collapsed')) {
            updateCollapsedTitle(card);
        }
    });

    // Listener for collapsing/expanding the card
    const header = card.querySelector('.question-card-header');
    header.addEventListener('click', (e) => {
        // Don't toggle if clicking a button inside the header
        if (!e.target.closest('button')) {
            if (card.classList.contains('collapsed')) {
                expandCard(card);
            } else {
                collapseCard(card);
            }
        }
    });

    // Listener for deleting the card
    card.querySelector('.delete-question-btn').addEventListener('click', (e) => {
        e.currentTarget.closest('.question-card').remove();
        renumberQuestionCards();
        updateReorderButtons();
        updateToggleAllButtonState();
        setUnsavedState(true);
    });
    
    // Add listeners for reorder buttons
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
            
            editGameScreen.scrollBy({
                top: scrollDelta,
                behavior: 'auto'
            });

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

            editGameScreen.scrollBy({
                top: scrollDelta,
                behavior: 'auto'
            });
            
            renumberQuestionCards();
            updateReorderButtons();
            setUnsavedState(true);
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
    updateToggleAllButtonState();
}

/**
 * Fetches and loads a game's data into the editor form from localStorage or a file.
 * @param {string} fileName - The JSON file name of the game to load.
 */
async function loadGameForEditing(fileName) {
    if (!fileName) {
        gameEditorForm.classList.add('hidden');
        setUnsavedState(false);
        return;
    }
    try {
        let gameData = null;
        const storedData = localStorage.getItem(`game_data_${fileName}`);
        
        if (storedData) {
            gameData = JSON.parse(storedData);
        } else {
            const response = await fetch(`./data/${fileName}`);
            if (!response.ok) throw new Error(`Network response was not ok for ${fileName}`);
            gameData = await response.json();
            // Cache it in localStorage for future edits
            localStorage.setItem(`game_data_${fileName}`, JSON.stringify(gameData));
        }
        
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
        setUnsavedState(false);
    } catch (error) {
        console.error(`Failed to load game data from ${fileName}:`, error);
        alert(`שגיאה בטעינת המשחק: ${fileName}`);
    }
}

/**
 * Populates the game selection dropdown from a manifest file and localStorage.
 */
async function populateGameSelector() {
    // Clear existing options except the first placeholder
    while (gameEditorSelect.options.length > 1) {
        gameEditorSelect.remove(1);
    }

    try {
        // 1. Get base manifest
        const manifestResponse = await fetch('./data/manifest.json');
        if (!manifestResponse.ok) throw new Error('Could not load game manifest.');
        const baseFiles = await manifestResponse.json();

        // 2. Get user manifest from localStorage
        let userFiles = [];
        try {
            userFiles = JSON.parse(localStorage.getItem('userGamesManifest')) || [];
        } catch (e) {
            console.error("Could not parse user games manifest from localStorage.", e);
        }

        // 3. Combine and ensure uniqueness
        const allFiles = [...new Set([...baseFiles, ...userFiles])];

        const fetchPromises = allFiles.map(async (fileName) => {
            try {
                let data = null;
                const storedData = localStorage.getItem(`game_data_${fileName}`);
                
                if (storedData) {
                    data = JSON.parse(storedData);
                } else if (baseFiles.includes(fileName)) { // Only try to fetch base games
                    const response = await fetch(`./data/${fileName}`);
                    if (response.ok) {
                        data = await response.json();
                        localStorage.setItem(`game_data_${fileName}`, JSON.stringify(data));
                    }
                }

                if (data) {
                    return { name: data.game_name, file: fileName };
                }
                return null;

            } catch (error) {
                console.error(`Failed to load or parse game name for ${fileName}:`, error);
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
    document.getElementById('global-home-btn').classList.remove('hidden');
    delete gameEditorForm.dataset.currentFile; // Clear any previously set filename
    populateGameSelector();
}

/**
 * Initializes all event listeners for the edit game screen.
 */
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

    // Add listener to form to detect any input changes
    gameEditorForm.addEventListener('input', () => setUnsavedState(true));

    addQuestionBtn.addEventListener('click', () => {
        const questionCount = questionsEditorContainer.children.length;
        renderQuestionCard({ q: '', a: '', timer: 30 }, questionCount);
        updateReorderButtons();
        updateToggleAllButtonState();
        setUnsavedState(true);
    });

    saveGameBtn.addEventListener('click', async () => {
        const gameData = compileGameData();
        const fileName = gameEditorForm.dataset.currentFile;

        if (!fileName) {
            alert('לא נבחר קובץ לשמירה. אנא צור משחק חדש או בחר משחק קיים.');
            return;
        }
        
        if (gameData) {
            try {
                // Save to localStorage
                localStorage.setItem(`game_data_${fileName}`, JSON.stringify(gameData));
                
                showSavedState();
    
                // Refresh the list to show the new name if it was changed
                const currentlySelected = gameEditorSelect.value;
                await populateGameSelector();
                gameEditorSelect.value = currentlySelected;
    
            } catch (e) {
                console.error("Error saving game to localStorage", e);
                alert("שגיאה בשמירת המשחק. ייתכן שאחסון הדפדפן מלא.");
            }
        }
    });

    downloadGameBtn.addEventListener('click', () => {
        const gameData = compileGameData();
        const fileName = gameEditorForm.dataset.currentFile;

        if (!fileName) {
            alert('לא נבחר משחק להורדה. אנא בחר משחק קיים.');
            return;
        }

        if (gameData) {
            downloadJsonFile(fileName, gameData);
        }
    });

    // --- Single Toggle Button Listener ---
    toggleAllQuestionsBtn.addEventListener('click', () => {
        const cards = questionsEditorContainer.querySelectorAll('.question-card');
        // If the button is in 'expand' mode, it means at least one is collapsed, so expand all.
        if (toggleAllQuestionsBtn.classList.contains('state-expand')) {
            cards.forEach(expandCard);
        } else { // Otherwise, collapse all.
            cards.forEach(collapseCard);
        }
    });


    // --- Modal Logic ---
    createNewGameBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.remove('hidden');
        newGameNameInput.focus();
    });

    cancelNewGameBtn.addEventListener('click', () => {
        newGameModalOverlay.classList.add('hidden');
    });

    confirmNewGameBtn.addEventListener('click', async () => {
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
        
        // Create empty game structure
        const newGameData = {
            game_name: newName,
            questions: [],
            final_question: { q: "", a: "" }
        };
    
        try {
            // Save new game data to localStorage
            localStorage.setItem(`game_data_${newFilename}`, JSON.stringify(newGameData));
    
            // Update user games manifest
            let userGames = [];
            try {
                userGames = JSON.parse(localStorage.getItem('userGamesManifest')) || [];
            } catch (e) {
                console.warn("Could not parse existing user games manifest. Starting fresh.", e);
            }
            if (!userGames.includes(newFilename)) {
                userGames.push(newFilename);
            }
            localStorage.setItem('userGamesManifest', JSON.stringify(userGames));
            
            // Hide modal and clear inputs
            newGameModalOverlay.classList.add('hidden');
            newGameNameInput.value = '';
            newGameFilenameInput.value = '';
    
            // Refresh selector and load the new game for editing
            await populateGameSelector();
            gameEditorSelect.value = newFilename; // Select the new game
            await loadGameForEditing(newFilename); // Load it into the form
    
            alert(`משחק חדש "${newName}" נוצר ונשמר. כעת ניתן לערוך אותו.`);
    
        } catch(e) {
            console.error("Error creating new game:", e);
            alert("שגיאה ביצירת המשחק החדש.");
        }
    });
    
    // Add auto-resize listeners for final question textareas
    finalQuestionQInput.addEventListener('input', () => autoResizeTextarea(finalQuestionQInput));
    finalQuestionAInput.addEventListener('input', () => autoResizeTextarea(finalQuestionAInput));
}