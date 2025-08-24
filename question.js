// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const timerValue = document.getElementById('timer-value');
const stopGameBtn = document.getElementById('stop-game-btn');
const answerControls = document.getElementById('answer-controls');
const correctAnswerBtn = document.getElementById('correct-answer-btn');
const incorrectAnswerBtn = document.getElementById('incorrect-answer-btn');

// --- State ---
let timerInterval = null;
let onQuestionCompleteCallback = null;

// --- Private Functions ---
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

/**
 * Handles the completion of a question, either by answering or timeout.
 * @param {boolean} wasCorrect - True if the answer was correct, false otherwise.
 */
function handleAnswer(wasCorrect) {
    stopTimer();
    if (onQuestionCompleteCallback) {
        onQuestionCompleteCallback(wasCorrect);
    }
}

// --- Public (Exported) Functions ---

/**
 * Shows the main game screen with the question and starts the timer.
 * @param {number} startTime - The number of seconds for the timer.
 */
export function showQuestionScreen(startTime = 30) {
    gameScreen.classList.remove('hidden');
    stopGameBtn.classList.remove('hidden');
    answerControls.classList.add('hidden');
    
    stopTimer();
    let timeLeft = startTime;
    timerValue.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerValue.textContent = timeLeft;
        if (timeLeft <= 0) {
            handleAnswer(false); // Time's up, treated as incorrect
        }
    }, 1000);
}

/**
 * Initializes listeners for the question screen controls.
 * @param {function} onComplete - Callback for when the question is answered or time runs out. 
 *                                It receives a boolean indicating if the answer was correct.
 */
export function initializeQuestionScreen(onComplete) {
    onQuestionCompleteCallback = onComplete;
    
    stopGameBtn.addEventListener('click', () => {
        stopTimer();
        stopGameBtn.classList.add('hidden');
        answerControls.classList.remove('hidden');
    });

    correctAnswerBtn.addEventListener('click', () => handleAnswer(true));
    incorrectAnswerBtn.addEventListener('click', () => handleAnswer(false));
}
