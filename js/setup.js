import { getGames } from './auth.js';

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

    const gameId = selectedGameLi.dataset.gameId;
    const game = gameDataCache[gameId];
    
    if (!game) {
        questionBankStat.textContent = 'בנק שאלות: טוען...';
        actualQuestionsStat.textContent = 'שאלות בפועל: טוען...';
        startButton.disabled = true; // Disable if data is not loaded yet
        return;
    };
    
    const questions = game.content.questions || [];
    const questionBankCount = questions.length;
    const numberOfGroups = parseInt(selectedGroupLi.textContent, 10);

    const actualQuestionsCount = Math.floor(questionBankCount / numberOfGroups) * numberOfGroups;

    questionBankStat.textContent = `בנק שאלות: ${questionBankCount}`;
    actualQuestionsStat.textContent = `שאלות בפועל: ${actualQuestionsCount}`;

    // Disable start button if there are no questions for a new game
    if (actualQuestionsCount === 0) {
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
 * Fetches games from Appwrite, caches them, and populates the selection list.
 */
export async function populateGameList() {
    gameList.innerHTML = '<li>טוען משחקים...</li>'; // Clear and show loading state
    gameDataCache = {};

    try {
        const games = await getGames();
        gameList.innerHTML = ''; // Clear loading state

        if (games.length === 0) {
             gameList.innerHTML = '<li>לא נמצאו משחקים. צור משחק חדש במסך ההגדרות!</li>';
             return;
        }

        games.forEach((game, index) => {
            gameDataCache[game.$id] = game; // Cache the full game document
            const li = document.createElement('li');
            li.textContent = game.name;
            li.dataset.gameId = game.$id; // Store the document ID
            if (index === 0) {
                li.classList.add('selected'); // Select the first game by default
            }
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');
            gameList.appendChild(li);
        });

        updateQuestionStats();

    } catch (error) {
        console.error('Failed to populate game list:', error);
        gameList.innerHTML = '<li>שגיאה בטעינת רשימת המשחקים</li>';
    }
}

/**
 * This function can be called when the setup screen is shown to ensure its state is fresh.
 * (Currently just updates stats, but could be expanded).
 */
export function refreshSetupScreenState() {
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

    groupList.addEventListener('click', (e) => {
        handleSelection(groupList, e);
        updateQuestionStats();
    });
    gameList.addEventListener('click', (e) => {
        handleSelection(gameList, e);
        updateQuestionStats();
    });

    startButton.addEventListener('click', () => {
        const actualQuestionsText = document.getElementById('actual-questions-stat').textContent;
        const actualQuestions = parseInt(actualQuestionsText.split(':')[1].trim(), 10) || 0;

        if (actualQuestions === 0) {
            alert('לא ניתן להתחיל את המשחק כי מספר השאלות בפועל הוא אפס. אנא בחר מספר קבוצות קטן יותר.');
            return;
        }

        setupScreen.classList.add('hidden');
        
        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const selectedGameLi = gameList.querySelector('.selected');
        const gameId = selectedGameLi ? selectedGameLi.dataset.gameId : null;
        
        if (!gameId) {
            alert('אנא בחר משחק.');
            setupScreen.classList.remove('hidden');
            return;
        }
        
        const gameData = gameDataCache[gameId].content;
        const shuffleQuestions = document.getElementById('shuffle-questions').checked;
        
        onStart({ numberOfGroups, gameData, shuffleQuestions, actualQuestions });
    });
}