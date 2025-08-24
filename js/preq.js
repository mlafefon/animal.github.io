// --- Elements ---
const preQuestionScreen = document.getElementById('pre-question-screen');
const gameScreen = document.getElementById('game-screen');
const nextQuestionBtn = document.getElementById('next-question-btn');
const betQuestionBtn = document.getElementById('bet-question-btn');
const preQuestionGameTitle = document.getElementById('pre-question-game-title');
const preQuestionNumber = document.getElementById('pre-question-number');
const preQuestionTime = document.getElementById('pre-question-time');

/**
 * Updates the pre-question screen with the current game state and displays it.
 * This function is called from game.js to transition to this screen.
 * @param {object} options - The game state.
 * @param {string} options.gameName - The name of the game.
 * @param {number} options.currentQuestionNumber - The current question number.
 * @param {number} options.totalQuestions - The total number of questions.
 * @param {number} options.startTime - The time for the question.
 */
export function showPreQuestionScreen(options) {
    const { gameName, currentQuestionNumber, totalQuestions, startTime } = options;

    preQuestionGameTitle.textContent = `משחק: ${gameName}`;
    preQuestionNumber.textContent = `שאלה ${currentQuestionNumber} מתוך ${totalQuestions}`;
    preQuestionTime.textContent = `מספר שניות למתן תשובה: ${startTime}`;
    preQuestionTime.dataset.time = startTime; // Store time for the callback
    
    // Ensure only the pre-question screen is visible
    gameScreen.classList.add('hidden');
    document.getElementById('setup-screen').classList.add('hidden');
    preQuestionScreen.classList.remove('hidden');
}

/**
 * Initializes listeners for the pre-question screen buttons.
 * This is called once when the application loads.
 * @param {function} onNext - Callback function for when "Next Question" is clicked.
 */
export function initializePreQuestionScreen(onNext) {
    nextQuestionBtn.addEventListener('click', () => {
        preQuestionScreen.classList.add('hidden');
        const startTime = parseInt(preQuestionTime.dataset.time, 10) || 30;
        onNext(startTime); // This will trigger showQuestionScreen via index.js
    });

    betQuestionBtn.addEventListener('click', () => {
        // Placeholder for future functionality
        alert('שאלת ההימור תהיה זמינה בקרוב!');
        console.log('Bet button clicked');
    });
}