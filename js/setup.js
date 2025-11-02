import { listGames } from './appwriteService.js';

const groupList = document.getElementById('group-list');
const gameList = document.getElementById('game-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');

let gameDataCache = {};


/**
 * Updates the UI with the number of questions in the bank and the calculated
 * number of questions that will actually be used in the game. It also enables/disables
 * the start button based on the number of actual questions.
 */
function updateQuestionStats() {
    const selectedGameLi = gameList.querySelector('.selected');
    const selectedGroupLi = groupList.querySelector('.selected');
    const questionBankStat = document.getElementById('question-bank-stat');
    const actualQuestionsStat = document.getElementById('actual-questions-stat');

    if (!selectedGameLi || !selectedGroupLi || !questionBankStat || !actualQuestionsStat) {
        return;
    }

    const documentId = selectedGameLi.dataset.documentId;
    const gameData = gameDataCache[documentId];
    
    if (!gameData) {
        questionBankStat.textContent = 'בנק שאלות: טוען...';
        actualQuestionsStat.textContent = 'שאלות בפועל: טוען...';
        startButton.disabled = true; // Disable if data is not loaded yet
        return;
    };

    const questionBankCount = gameData.questions.length;
    const numberOfGroups = parseInt(selectedGroupLi.textContent, 10);

    const actualQuestionsCount = Math.floor(questionBankCount / numberOfGroups) * numberOfGroups;

    questionBankStat.textContent = `בנק שאלות: ${questionBankCount}`;
    actualQuestionsStat.textContent = `שאלות בפועל: ${actualQuestionsCount}`;

    const canContinue = document.getElementById('continue-last-point').checked;
    
    // Disable start button if there are no questions for a new game
    if (actualQuestionsCount === 0 && !canContinue) {
        startButton.disabled = true;
        startButton.title = 'לא ניתן להתחיל משחק ללא שאלות. יש לבחור פחות קבוצות.';
    } else {
        startButton.disabled = false;
        startButton.title = '';
    }
}


/**
 * Handles clicks on selection lists (like groups or games) to apply the 'selected' class.
 * @param {HTMLElement} list - The UL element.
 * @param {Event} event - The click event.
 */
function handleSelection(list, event) {
    if (event.target.tagName === 'LI') {
        [...list.children].forEach(li => li.classList.remove('selected'));
        event.target.classList.add('selected');
    }
}

/**
 * Fetches game from Appwrite, caches their data, and populates the selection list.
 */
export async function populateGameList() {
    gameList.innerHTML = '<li>טוען משחקים...</li>'; // Show loading indicator
    gameDataCache = {}; // Clear cache on repopulation

    try {
        const games = await listGames();
        gameList.innerHTML = ''; // Clear loading indicator
        
        if (games.length === 0) {
            gameList.innerHTML = '<li>לא נמצאו משחקים. צור משחק חדש במסך העריכה.</li>';
            return;
        }

        games.forEach((game, index) => {
            try {
                // The game_data is a string, we need to parse it to get questions
                const fullGameData = JSON.parse(game.game_data);
                gameDataCache[game.$id] = fullGameData; // Cache the parsed data

                const li = document.createElement('li');
                li.textContent = game.game_name;
                li.dataset.documentId = game.$id;
                li.dataset.gameData = game.game_data; // Store the raw string data as well

                if (index === 0) {
                    li.classList.add('selected'); // Select the first game by default
                }
                
                li.setAttribute('role', 'button');
                li.setAttribute('tabindex', '0');
                gameList.appendChild(li);
            } catch (parseError) {
                console.error(`Could not parse game data for "${game.game_name}" (ID: ${game.$id})`, parseError);
                // Optionally, skip this game in the list
            }
        });

        // Initial update after loading and populating
        updateQuestionStats();

    } catch (error) {
        console.error('Failed to populate game list:', error);
        gameList.innerHTML = '<li>שגיאה בטעינת רשימת המשחקים</li>';
    }
}

/**
 * Toggles the enabled/disabled state of the main setup controls.
 * @param {boolean} disabled - True to disable, false to enable.
 */
function toggleSetupControls(disabled) {
    groupList.style.pointerEvents = disabled ? 'none' : 'auto';
    groupList.style.opacity = disabled ? 0.6 : 1;
    gameList.style.pointerEvents = disabled ? 'none' : 'auto';
    gameList.style.opacity = disabled ? 0.6 : 1;
    document.getElementById('shuffle-questions').disabled = disabled;
}

/**
 * Selects the group and game list items based on the loaded saved game state.
 */
function applySavedStateSelections() {
    const savedStateJSON = localStorage.getItem('animalGameState');
    if (!savedStateJSON) return;

    try {
        const savedState = JSON.parse(savedStateJSON);
        if (!savedState) return;

        // Select Number of Groups
        const numberOfGroups = savedState.teams.length;
        [...groupList.children].forEach(li => {
            li.classList.toggle('selected', parseInt(li.textContent, 10) === numberOfGroups);
        });

        // Select Game
        const documentId = savedState.options.documentId;
        [...gameList.children].forEach(li => {
            li.classList.toggle('selected', li.dataset.documentId === documentId);
        });
        
        updateQuestionStats();
    } catch(e) {
        console.error("Could not parse saved state to apply selections:", e);
    }
}

/**
 * Checks for a saved game state and updates the "Continue" checkbox accordingly.
 * This should be called each time the setup screen is shown.
 */
export function refreshSetupScreenState() {
    const continueCheckbox = document.getElementById('continue-last-point');
    const continueLabel = document.querySelector('label[for="continue-last-point"]');
    const savedStateJSON = localStorage.getItem('animalGameState');

    if (savedStateJSON) {
        try {
            const savedState = JSON.parse(savedStateJSON);
            continueCheckbox.disabled = false;
            continueLabel.textContent = `המשך "${savedState.gameName}"`;
        } catch (e) {
            // Handle corrupted saved data
            continueCheckbox.disabled = true;
            continueLabel.textContent = 'המשך מנקודה אחרונה';
            localStorage.removeItem('animalGameState');
        }
    } else {
        continueCheckbox.disabled = true;
        continueLabel.textContent = 'המשך מנקודה אחרונה';
    }
    
    // Always start with the checkbox unchecked and controls enabled.
    continueCheckbox.checked = false;
    toggleSetupControls(false);
    updateQuestionStats(); // Update button state
}


/**
 * Initializes the setup screen by attaching event listeners.
 * @param {function} onStart - The callback function to execute when the start button is clicked.
 */
export function initializeSetupScreen(onStart) {
    // Add accessibility attributes to static group list items
    groupList.querySelectorAll('li').forEach(li => {
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
    });

    const continueCheckbox = document.getElementById('continue-last-point');
    
    continueCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        toggleSetupControls(isChecked);
        if (isChecked) {
            applySavedStateSelections();
        }
        updateQuestionStats(); // Re-check button state
    });

    groupList.addEventListener('click', (e) => {
        handleSelection(groupList, e);
        updateQuestionStats();
    });
    gameList.addEventListener('click', (e) => {
        handleSelection(gameList, e);
        updateQuestionStats();
    });

    startButton.addEventListener('click', () => {
        // Get the calculated number of questions from the UI to check before proceeding
        const actualQuestionsText = document.getElementById('actual-questions-stat').textContent;
        const actualQuestions = parseInt(actualQuestionsText.split(':')[1].trim(), 10) || 0;
        const continueLastPoint = document.getElementById('continue-last-point').checked;

        // This check should only apply when starting a new game.
        // When continuing, we trust the saved state has questions.
        if (actualQuestions === 0 && !continueLastPoint) {
            alert('לא ניתן להתחיל את המשחק כי מספר השאלות בפועל הוא אפס. אנא בחר מספר קבוצות קטן יותר.');
            return; // Stop here, don't hide the screen or start the game
        }

        setupScreen.classList.add('hidden');
        
        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const selectedGame = gameList.querySelector('.selected');
        const documentId = selectedGame ? selectedGame.dataset.documentId : '';
        const gameDataString = selectedGame ? selectedGame.dataset.gameData : '{}';

        if (!documentId) {
            alert('לא נבחר משחק. אנא בחר משחק מהרשימה.');
            setupScreen.classList.remove('hidden');
            return;
        }

        const shuffleQuestions = document.getElementById('shuffle-questions').checked;
        
        onStart({ numberOfGroups, documentId, gameDataString, shuffleQuestions, actualQuestions, continueLastPoint });
    });
}