

import { getSavedState } from './gameState.js';
import { TEAMS_MASTER_DATA } from './game.js';
import { showNotification } from './ui.js';

const groupList = document.getElementById('group-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');
const setupGameTitle = document.getElementById('setup-game-title');


let selectedGameDocument = null;
let selectedGameData = null;


/**
 * Creates or updates the session state in localStorage for participants to see.
 * This function preserves the 'isTaken' status of teams if the session already exists.
 */
function createOrUpdateParticipantSession() {
    if (!selectedGameDocument || !selectedGameDocument.gameCode) return;

    const gameCode = selectedGameDocument.gameCode;
    const gameName = selectedGameDocument.game_name;
    const selectedGroup = groupList.querySelector('.selected');
    const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;

    const teamsForParticipants = [];
    for (let i = 0; i < numberOfGroups; i++) {
        const teamMaster = TEAMS_MASTER_DATA[i % TEAMS_MASTER_DATA.length];
        teamsForParticipants.push({
            index: i,
            name: teamMaster.name,
            icon: teamMaster.icon,
            isTaken: false
        });
    }

    const sessionKey = `animalGameSession_${gameCode}`;
    const existingSessionJSON = localStorage.getItem(sessionKey);
    let gameState = 'setup';

    if (existingSessionJSON) {
        const existingSession = JSON.parse(existingSessionJSON);
        // Preserve isTaken status if host changes number of teams
        if (existingSession.teams) {
            teamsForParticipants.forEach(newTeam => {
                const oldTeam = existingSession.teams.find(t => t.index === newTeam.index);
                if (oldTeam && oldTeam.isTaken) {
                    newTeam.isTaken = true;
                }
            });
        }
        if (existingSession.gameState && existingSession.gameState !== 'setup') {
            gameState = existingSession.gameState;
        }
    }

    const newSessionState = {
        gameCode: gameCode,
        gameName: gameName,
        teams: teamsForParticipants,
        gameState: gameState,
    };
    localStorage.setItem(sessionKey, JSON.stringify(newSessionState));
}

/**
 * Updates the UI with the number of questions in the bank and the calculated
 * number of questions that will actually be used in the game. It also enables/disables
 * the start button based on the number of actual questions.
 */
function updateQuestionStats() {
    const selectedGroupLi = groupList.querySelector('.selected');
    const questionBankStat = document.getElementById('question-bank-stat');
    const actualQuestionsStat = document.getElementById('actual-questions-stat');

    if (!selectedGroupLi || !questionBankStat || !actualQuestionsStat) {
        return;
    }
    
    if (!selectedGameData) {
        questionBankStat.textContent = 'בנק שאלות: --';
        actualQuestionsStat.textContent = 'שאלות בפועל: --';
        startButton.disabled = true;
        startButton.title = 'יש לבחור משחק';
        return;
    };

    const questionBankCount = selectedGameData.questions.length;
    const numberOfGroups = parseInt(selectedGroupLi.textContent, 10);

    const actualQuestionsCount = Math.floor(questionBankCount / numberOfGroups) * numberOfGroups;

    questionBankStat.textContent = `בנק שאלות: ${questionBankCount}`;
    actualQuestionsStat.textContent = `שאלות בפועל: ${actualQuestionsCount}`;

    const canContinue = document.getElementById('continue-last-point').checked;
    
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
 * Toggles the enabled/disabled state of the main setup controls.
 * @param {boolean} disabled - True to disable, false to enable.
 */
function toggleSetupControls(disabled) {
    groupList.style.pointerEvents = disabled ? 'none' : 'auto';
    groupList.style.opacity = disabled ? 0.6 : 1;
    document.getElementById('shuffle-questions').disabled = disabled;
}

/**
 * Checks for a saved game state and updates the "Continue" checkbox accordingly.
 * This should be called each time the setup screen is shown.
 */
export async function refreshSetupScreenState() {
    const continueCheckbox = document.getElementById('continue-last-point');
    const continueLabel = document.querySelector('label[for="continue-last-point"]');
    const savedState = getSavedState(); // Use new centralized function

    if (savedState && savedState.gameName) {
        continueCheckbox.disabled = false;
        continueLabel.textContent = `המשך "${savedState.gameName}"`;
    } else {
        continueCheckbox.disabled = true;
        continueLabel.textContent = 'המשך מנקודה אחרונה';
        if (savedState) { // If state exists but is corrupt/missing name
            localStorage.removeItem('animalGameState'); // Clean it up
        }
    }
    
    continueCheckbox.checked = false;
    toggleSetupControls(false);
}

/**
 * Shows the setup screen for a specific game chosen from the previous screen.
 * @param {object} gameDoc The full game document from Appwrite.
 */
export function showSetupScreenForGame(gameDoc) {
    selectedGameDocument = gameDoc;
    try {
        selectedGameData = JSON.parse(gameDoc.game_data);
    } catch (e) {
        alert('שגיאה בנתוני המשחק שנבחר.');
        console.error("Could not parse game data in setup:", e);
        return;
    }

    if (setupGameTitle) {
        setupGameTitle.textContent = selectedGameDocument.game_name;
    }

    const gameCode = Math.floor(100000 + Math.random() * 900000);
    const gameCodeDisplay = document.getElementById('game-code-display');
    if (gameCodeDisplay) {
        gameCodeDisplay.textContent = gameCode;
    }
    selectedGameDocument.gameCode = gameCode; // Attach to the document object for later use

    refreshSetupScreenState(); // Handles the "continue" checkbox state
    setupScreen.classList.remove('hidden');
    updateQuestionStats();
    createOrUpdateParticipantSession(); // Create session as soon as code is visible
}


/**
 * Initializes the setup screen by attaching event listeners.
 * @param {function} onStart - The callback function to execute when the start button is clicked.
 */
export function initializeSetupScreen(onStart) {
    groupList.querySelectorAll('li').forEach(li => {
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
    });

    const continueCheckbox = document.getElementById('continue-last-point');
    
    continueCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        toggleSetupControls(isChecked);
        // The logic to apply selections has been removed, as it's not relevant in this flow.
        // If the user wants to continue, they will press Start and the game logic will handle it.
        updateQuestionStats();
    });

    groupList.addEventListener('click', (e) => {
        handleSelection(groupList, e);
        updateQuestionStats();
        createOrUpdateParticipantSession(); // Update session on group change
    });

    const gameCodeDisplay = document.getElementById('game-code-display');
    if(gameCodeDisplay) {
        gameCodeDisplay.addEventListener('click', () => {
            navigator.clipboard.writeText(gameCodeDisplay.textContent).then(() => {
                showNotification('הקוד הועתק!', 'success');
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                showNotification('שגיאה בהעתקת הקוד', 'error');
            });
        });
    }

    startButton.addEventListener('click', () => {
        const actualQuestionsText = document.getElementById('actual-questions-stat').textContent;
        const actualQuestions = parseInt(actualQuestionsText.split(':')[1].trim(), 10) || 0;
        const continueLastPoint = document.getElementById('continue-last-point').checked;

        if (actualQuestions === 0 && !continueLastPoint) {
            alert('לא ניתן להתחיל את המשחק כי מספר השאלות בפועל הוא אפס. אנא בחר מספר קבוצות קטן יותר.');
            return;
        }

        if (!selectedGameDocument && !continueLastPoint) {
            alert('אירעה שגיאה. לא נבחר משחק.');
            return;
        }

        setupScreen.classList.add('hidden');
        
        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const documentId = selectedGameDocument ? selectedGameDocument.$id : null;
        const gameDataString = selectedGameDocument ? selectedGameDocument.game_data : '{}';
        const gameName = selectedGameDocument ? selectedGameDocument.game_name : '';
        const gameCode = selectedGameDocument ? selectedGameDocument.gameCode : null;
        
        const shuffleQuestions = document.getElementById('shuffle-questions').checked;
        
        // The participant session is already created/updated. Just start the game.
        onStart({ numberOfGroups, documentId, gameDataString, shuffleQuestions, actualQuestions, continueLastPoint, gameName, gameCode });
    });
}
