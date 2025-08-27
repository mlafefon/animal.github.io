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
 * @param {string} [options.gameName] - The name of the game.
 * @param {number} [options.currentQuestionNumber] - The current question number.
 * @param {number} [options.totalQuestions] - The total number of questions.
 * @param {number} [options.startTime] - The time for the question.
 * @param {boolean} [options.isFinalRound=false] - Flag for the final betting round.
 */
export function showPreQuestionScreen(options) {
    if (options.isFinalRound) {
        preQuestionGameTitle.textContent = 'הסיבוב האחרון!';
        preQuestionNumber.textContent = 'שאלת ההימור הסופית';
        preQuestionTime.textContent = 'כל קבוצה מהמרת על הנקודות שצברה';
        
        nextQuestionBtn.classList.add('hidden');
        betQuestionBtn.classList.remove('hidden');
    } else {
        const { gameName, currentQuestionNumber, totalQuestions, startTime } = options;
        preQuestionGameTitle.textContent = `משחק: ${gameName}`;
        preQuestionNumber.textContent = `שאלה ${currentQuestionNumber} מתוך ${totalQuestions}`;
        preQuestionTime.textContent = `מספר שניות למתן תשובה: ${startTime}`;
        preQuestionTime.dataset.time = startTime; // Store time for the callback

        nextQuestionBtn.classList.remove('hidden');
        betQuestionBtn.classList.add('hidden');
    }
    
    // Ensure only the pre-question screen is visible
    gameScreen.classList.add('hidden');
    document.getElementById('setup-screen').classList.add('hidden');
    preQuestionScreen.classList.remove('hidden');
}

/**
 * Initializes listeners for the pre-question screen buttons.
 * This is called once when the application loads.
 * @param {function} onNext - Callback function for when "Next Question" is clicked.
 * @param {function} onStartBetting - Callback function for when "Bet Question" is clicked in the final round.
 */
export function initializePreQuestionScreen(onNext, onStartBetting) {
    nextQuestionBtn.addEventListener('click', () => {
        preQuestionScreen.classList.add('hidden');
        const startTime = parseInt(preQuestionTime.dataset.time, 10) || 30;
        onNext(startTime); // This will trigger showQuestionScreen via index.js
    });

    betQuestionBtn.addEventListener('click', () => {
        // This button now has two contexts. We assume it's only clickable
        // when visible, and its visibility is controlled by showPreQuestionScreen.
        // If it's the final round, this callback will be defined.
        if (onStartBetting) {
            preQuestionScreen.classList.add('hidden');
            onStartBetting();
        } else {
            // Placeholder for future functionality if used mid-game
            alert('שאלת ההימור תהיה זמינה בקרוב!');
        }
    });
}