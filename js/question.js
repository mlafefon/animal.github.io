import { getCurrentQuestion } from './game.js';
import { showBoxesScreen } from './boxes.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const timerValue = document.getElementById('timer-value');
const timerProgressRing = document.getElementById('timer-progress-ring');
const stopGameBtn = document.getElementById('stop-game-btn');
const answerControls = document.getElementById('answer-controls');
const correctAnswerBtn = document.getElementById('correct-answer-btn');
const incorrectAnswerBtn = document.getElementById('incorrect-answer-btn');
const questionText = document.getElementById('question-text');
const answerContainer = document.getElementById('answer-container');
const answerText = document.getElementById('answer-text');
const victoryBoxBtn = document.getElementById('victory-box-btn');
const failureControls = document.getElementById('failure-controls');
const failureBoxBtn = document.getElementById('failure-box-btn');
const passQuestionBtn = document.getElementById('pass-question-btn');


// --- State ---
let timerInterval = null;
let onQuestionCompleteCallback = null;

// --- Private Functions ---
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

/**
 * Handles an incorrect answer or timeout by ending the current team's turn.
 */
function handleTurnEnd() {
    stopTimer();
    if (onQuestionCompleteCallback) {
        onQuestionCompleteCallback();
    }
}

// --- Public (Exported) Functions ---

/**
 * Shows the main game screen with the question and starts the timer.
 * @param {number} startTime - The number of seconds for the timer.
 */
export function showQuestionScreen(startTime = 30) {
    const currentQuestion = getCurrentQuestion();
    questionText.textContent = currentQuestion.q;

    gameScreen.classList.remove('hidden');
    stopGameBtn.classList.remove('hidden');
    answerControls.classList.add('hidden');
    failureControls.classList.add('hidden');
    answerContainer.classList.add('hidden');
    victoryBoxBtn.classList.add('hidden');
    
    stopTimer();
    let timeLeft = startTime;
    timerValue.textContent = timeLeft;

    // --- Timer Animation Logic ---
    const radius = timerProgressRing.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    timerProgressRing.style.strokeDasharray = `${circumference} ${circumference}`;

    const updateRing = (current, total) => {
        const progress = current / total;
        // Prevent negative offsets
        const safeProgress = Math.max(0, progress); 
        const offset = circumference - safeProgress * circumference;
        timerProgressRing.style.strokeDashoffset = offset;
    };

    updateRing(timeLeft, startTime); // Set initial state (full)

    timerInterval = setInterval(() => {
        timeLeft--;
        timerValue.textContent = timeLeft;
        updateRing(timeLeft, startTime); // Update animation every second

        if (timeLeft <= 0) {
            handleTurnEnd(); // Time's up, ends the turn directly.
        }
    }, 1000);
}

/**
 * Initializes listeners for the question screen controls.
 * @param {function} onComplete - Callback for when the question is answered incorrectly or time runs out. 
 */
export function initializeQuestionScreen(onComplete) {
    onQuestionCompleteCallback = onComplete;
    
    stopGameBtn.addEventListener('click', () => {
        stopTimer();
        stopGameBtn.classList.add('hidden');
        answerControls.classList.remove('hidden');
    });

    correctAnswerBtn.addEventListener('click', () => {
        const currentQuestion = getCurrentQuestion();
        answerText.textContent = currentQuestion.a;
        answerContainer.classList.remove('hidden');

        answerControls.classList.add('hidden');
        victoryBoxBtn.classList.remove('hidden');
    });

    incorrectAnswerBtn.addEventListener('click', () => {
        answerControls.classList.add('hidden');
        failureControls.classList.remove('hidden');
    });

    failureBoxBtn.addEventListener('click', () => {
        showBoxesScreen({ mode: 'failure' });
    });

    passQuestionBtn.addEventListener('click', () => {
        failureControls.classList.add('hidden');
        handleTurnEnd();
    });

    victoryBoxBtn.addEventListener('click', () => {
        showBoxesScreen({ mode: 'victory' }); // Explicitly set mode
    });
}