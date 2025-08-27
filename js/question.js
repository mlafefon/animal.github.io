

import { getCurrentQuestion, getIsQuestionPassed, getTeamsInfo, passQuestionToTeam } from './game.js';
import { showBoxesScreen } from './boxes.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const timerContainer = document.getElementById('timer-container');
const timerValue = document.getElementById('timer-value');
const timerProgressRing = document.getElementById('timer-progress-ring');
const stopGameBtn = document.getElementById('stop-game-btn');
const answerControls = document.getElementById('answer-controls');
const correctAnswerBtn = document.getElementById('correct-answer-btn');
const incorrectAnswerBtn = document.getElementById('incorrect-answer-btn');
const questionContainer = document.getElementById('question-container');
const questionText = document.getElementById('question-text');
const answerContainer = document.getElementById('answer-container');
const answerText = document.getElementById('answer-text');
const victoryBoxBtn = document.getElementById('victory-box-btn');
const failureControls = document.getElementById('failure-controls');
const failureBoxBtn = document.getElementById('failure-box-btn');
const passQuestionBtn = document.getElementById('pass-question-btn');
const passQuestionModalOverlay = document.getElementById('pass-question-modal-overlay');
const passQuestionTeamsContainer = document.getElementById('pass-question-teams-container');
const cancelPassQuestionBtn = document.getElementById('cancel-pass-question-btn');
const undoAnswerChoiceBtn = document.getElementById('undo-answer-choice-btn');
const mainGameFooter = document.getElementById('main-game-footer');


// --- State ---
let timerInterval = null;
let onQuestionCompleteCallback = null;

// --- Private Functions ---

/**
 * Truncates text to a specific word limit, adding an ellipsis if needed.
 * @param {string} text - The text to truncate.
 * @param {number} [limit=5] - The word limit.
 * @returns {string} The truncated text.
 */
function truncateText(text, limit = 5) {
    if (!text) return '';
    const words = text.split(' ');
    if (words.length > limit) {
        return words.slice(0, limit).join(' ') + '...';
    }
    return text;
}

/**
 * Applies the "shrunk" state to a container (question or answer).
 * @param {HTMLElement} container - The container element.
 * @param {HTMLElement} textElement - The text element inside the container.
 */
function applyShrink(container, textElement) {
    const originalText = container.dataset.originalText;
    if (originalText) {
        textElement.textContent = truncateText(originalText);
        container.classList.add('shrunk');
    }
}

/**
 * Removes the "shrunk" state from a container, restoring its full text.
 * @param {HTMLElement} container - The container element.
 * @param {HTMLElement} textElement - The text element inside the container.
 */
function removeShrink(container, textElement) {
    const originalText = container.dataset.originalText;
    if (originalText) {
        textElement.textContent = originalText;
        container.classList.remove('shrunk');
    }
}

/**
 * Checks if the layout is cramped, meaning a given button is overlapping with the footer.
 * @param {HTMLElement} buttonElement - The button to check for overlap.
 * @returns {boolean} True if the layout is cramped, false otherwise.
 */
function isLayoutCramped(buttonElement) {
    if (!buttonElement || buttonElement.classList.contains('hidden') || !mainGameFooter.classList.contains('visible')) {
        return false;
    }
    const buttonRect = buttonElement.getBoundingClientRect();
    const footerRect = mainGameFooter.getBoundingClientRect();
    return buttonRect.bottom > footerRect.top - 10;
}


function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

/**
 * Handles an incorrect answer or timeout by ending the current team's turn.
 */
function handleTurnEnd() {
    stopTimer();
    timerContainer.classList.remove('low-time'); // Clean up animation class
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

    // Reset shrunk state and data for a new question
    questionContainer.classList.remove('shrunk');
    answerContainer.classList.remove('shrunk');
    delete gameScreen.dataset.isCramped; // Reset cramped state flag
    if (questionContainer.dataset.originalText) {
        delete questionContainer.dataset.originalText;
    }
     if (answerContainer.dataset.originalText) {
        delete answerContainer.dataset.originalText;
    }

    gameScreen.classList.remove('hidden');
    stopGameBtn.classList.remove('hidden');
    answerControls.classList.add('hidden');
    failureControls.classList.add('hidden');
    answerContainer.classList.add('hidden');
    victoryBoxBtn.classList.add('hidden');
    passQuestionModalOverlay.classList.add('hidden');
    undoAnswerChoiceBtn.classList.add('hidden');
    
    // Reset failure box button text for the new question
    failureBoxBtn.textContent = 'תיבת כישלון';

    timerContainer.classList.remove('low-time'); // Reset on new question
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

        // Add low-time warning visual cue
        if (timeLeft <= 5 && !timerContainer.classList.contains('low-time')) {
            timerContainer.classList.add('low-time');
        }

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
        timerContainer.classList.remove('low-time'); // Clean up animation class
        stopGameBtn.classList.add('hidden');
        answerControls.classList.remove('hidden');
    });

    correctAnswerBtn.addEventListener('click', () => {
        const currentQuestion = getCurrentQuestion();
        answerText.textContent = currentQuestion.a;
        answerContainer.classList.remove('hidden');

        answerControls.classList.add('hidden');
        victoryBoxBtn.classList.remove('hidden');
        undoAnswerChoiceBtn.classList.remove('hidden');

        // Store original text for hover logic
        questionContainer.dataset.originalText = currentQuestion.q;
        answerContainer.dataset.originalText = currentQuestion.a;

        // Check layout and apply shrink only if needed
        if (isLayoutCramped(victoryBoxBtn)) {
            gameScreen.dataset.isCramped = 'true';
            // Initial state for small screens: question is shrunk, answer is not.
            applyShrink(questionContainer, questionText);
            removeShrink(answerContainer, answerText); // Ensures it's expanded
        } else {
            delete gameScreen.dataset.isCramped;
            // On larger screens, keep both expanded
            removeShrink(questionContainer, questionText);
            removeShrink(answerContainer, answerText);
        }
    });

    incorrectAnswerBtn.addEventListener('click', () => {
        answerControls.classList.add('hidden');
        failureControls.classList.remove('hidden');
        undoAnswerChoiceBtn.classList.remove('hidden');

        // If the question was passed to this team, they can't pass it again.
        if (getIsQuestionPassed()) {
            passQuestionBtn.classList.add('hidden');
        } else {
            passQuestionBtn.classList.remove('hidden');
        }
    });

    undoAnswerChoiceBtn.addEventListener('click', () => {
        // Hide post-decision controls
        victoryBoxBtn.classList.add('hidden');
        failureControls.classList.add('hidden');
        undoAnswerChoiceBtn.classList.add('hidden');
        answerContainer.classList.add('hidden');

        // Clear the cramped state flag
        delete gameScreen.dataset.isCramped;

        // Restore containers and clear data
        if (questionContainer.dataset.originalText) {
            questionText.textContent = questionContainer.dataset.originalText;
            questionContainer.classList.remove('shrunk');
            delete questionContainer.dataset.originalText;
        }
        if (answerContainer.dataset.originalText) {
            answerContainer.classList.remove('shrunk');
            delete answerContainer.dataset.originalText;
        }
        
        // Reset the failure box button's text, just in case
        failureBoxBtn.textContent = 'תיבת כישלון';


        // Re-show the decision controls
        answerControls.classList.remove('hidden');
    });

    // --- Symmetrical Hover Logic (Conditional) ---
    const inAnswerState = () => !victoryBoxBtn.classList.contains('hidden') || (
        !failureControls.classList.contains('hidden') && !answerContainer.classList.contains('hidden')
    );
    const isShrinkActive = () => inAnswerState() && gameScreen.dataset.isCramped === 'true';

    const setDefaultState = () => {
        if (isShrinkActive()) {
            applyShrink(questionContainer, questionText);
            removeShrink(answerContainer, answerText);
        }
    };

    questionContainer.addEventListener('mouseenter', () => {
        if (isShrinkActive()) {
            removeShrink(questionContainer, questionText);
            applyShrink(answerContainer, answerText);
        }
    });
    questionContainer.addEventListener('mouseleave', setDefaultState);
    
    answerContainer.addEventListener('mouseenter', () => {
        if (isShrinkActive()) {
            removeShrink(answerContainer, answerText);
            applyShrink(questionContainer, questionText);
        }
    });
    answerContainer.addEventListener('mouseleave', setDefaultState);


    failureBoxBtn.addEventListener('click', () => {
        const isAnswerVisible = !answerContainer.classList.contains('hidden');

        if (!isAnswerVisible) {
            // First click: Reveal answer, hide pass button
            const currentQuestion = getCurrentQuestion();
            answerText.textContent = currentQuestion.a;
            answerContainer.classList.remove('hidden');
            passQuestionBtn.classList.add('hidden');

            // Store original text for hover/shrink logic
            questionContainer.dataset.originalText = currentQuestion.q;
            answerContainer.dataset.originalText = currentQuestion.a;

            // Check for cramped layout and apply shrink if necessary
            if (isLayoutCramped(failureBoxBtn)) {
                gameScreen.dataset.isCramped = 'true';
                applyShrink(questionContainer, questionText);
                removeShrink(answerContainer, answerText);
            } else {
                delete gameScreen.dataset.isCramped;
                removeShrink(questionContainer, questionText);
                removeShrink(answerContainer, answerText);
            }
            
            // Update button text to guide user for the next action
            failureBoxBtn.textContent = 'המשך לתיבה';
        } else {
            // Second click: Proceed to the boxes screen
            showBoxesScreen({ mode: 'failure' });
        }
    });

    passQuestionBtn.addEventListener('click', () => {
        stopTimer();
        timerContainer.classList.remove('low-time');

        const { teams, activeTeamIndex } = getTeamsInfo();
        passQuestionTeamsContainer.innerHTML = ''; // Clear previous teams

        teams.forEach(team => {
            if (team.index !== activeTeamIndex) {
                const teamElement = document.createElement('div');
                teamElement.className = 'team-member-modal-select';
                teamElement.dataset.index = team.index;
                teamElement.innerHTML = `
                    <div class="team-icon">
                        <img src="${team.icon}" alt="${team.name}">
                    </div>
                    <span>${team.name}</span>
                `;
                passQuestionTeamsContainer.appendChild(teamElement);
            }
        });

        passQuestionModalOverlay.classList.remove('hidden');
    });

    cancelPassQuestionBtn.addEventListener('click', () => {
        passQuestionModalOverlay.classList.add('hidden');
    });

    passQuestionTeamsContainer.addEventListener('click', (event) => {
        const selectedTeamEl = event.target.closest('.team-member-modal-select');
        if (selectedTeamEl) {
            const targetIndex = parseInt(selectedTeamEl.dataset.index, 10);
            
            passQuestionToTeam(targetIndex);

            passQuestionModalOverlay.classList.add('hidden');
            failureControls.classList.add('hidden');
            answerControls.classList.remove('hidden');
        }
    });

    victoryBoxBtn.addEventListener('click', () => {
        showBoxesScreen({ mode: 'victory' }); // Explicitly set mode
    });
}
