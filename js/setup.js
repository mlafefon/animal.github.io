

const groupList = document.getElementById('group-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');
const setupGameTitle = document.getElementById('setup-game-title');


let selectedGameDocument = null;
let selectedGameData = null;


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
    const savedStateJSON = localStorage.getItem('animalGameState');

    if (savedStateJSON) {
        try {
            const savedState = JSON.parse(savedStateJSON);
            continueCheckbox.disabled = false;
            continueLabel.textContent = `המשך "${savedState.gameName}"`;
        } catch (e) {
            continueCheckbox.disabled = true;
            continueLabel.textContent = 'המשך מנקודה אחרונה';
            localStorage.removeItem('animalGameState');
        }
    } else {
        continueCheckbox.disabled = true;
        continueLabel.textContent = 'המשך מנקודה אחרונה';
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
    refreshSetupScreenState(); // Handles the "continue" checkbox state
    setupScreen.classList.remove('hidden');
    updateQuestionStats();
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
    });

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

        const shuffleQuestions = document.getElementById('shuffle-questions').checked;
        
        onStart({ numberOfGroups, documentId, gameDataString, shuffleQuestions, actualQuestions, continueLastPoint });
    });
}