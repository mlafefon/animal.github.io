import { getCurrentQuestion, getIsQuestionPassed, getTeamsInfo, passQuestionToTeam } from './game.js';
import { showBoxesScreen } from './boxes.js';
import { playSound, stopSound } from './audio.js';
import { showLinkModal } from './ui.js';
import { getState, setParticipantState, setTimerState, clearTimerState } from './gameState.js';
import { updateGameSession } from './appwriteService.js';

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
const answerLinkBtn = document.getElementById('answer-link-btn');
const victoryBoxBtn = document.getElementById('victory-box-btn');
const failureControls = document.getElementById('failure-controls');
const failureBoxBtn = document.getElementById('failure-box-btn');
const passQuestionBtn = document.getElementById('pass-question-btn');
const passQuestionModalOverlay = document.getElementById('pass-question-modal-overlay');
const passQuestionTeamsContainer = document.getElementById('pass-question-teams-container');
const closePassQuestionModalBtn = document.getElementById('close-pass-question-modal-btn');
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


export function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    stopSound('timerTick');
    clearTimerState();
}

/**
 * Stops the timer and shows the manual grading buttons (Correct/Incorrect).
 * This is used when the 'Stop' button is clicked or when the timer runs out.
 */
export function triggerManualGrading() {
    stopTimer();
    timerContainer.classList.remove('low-time');

    // Add a one-time "stopped" animation
    timerContainer.classList.add('timer-stopped');
    timerContainer.addEventListener('animationend', () => {
        timerContainer.classList.remove('timer-stopped');
    }, { once: true });

    stopGameBtn.classList.add('hidden');
    answerControls.classList.remove('hidden');
    
    // Set focus on the next logical control for accessibility
    correctAnswerBtn.focus();

    // Update Appwrite state for participants
    const state = getState();
    if (!state.sessionDocumentId) return;
    
    setParticipantState('grading');
    document.dispatchEvent(new Event('gamestatechange'));
}


// --- Public (Exported) Functions ---

/**
 * Shows the main game screen with the question and starts the timer.
 * @param {number} startTime - The number of seconds for the timer.
 */
export function showQuestionScreen(startTime = 30) {
    const currentQuestion = getCurrentQuestion();
    questionText.textContent = currentQuestion.q;

    // Set state for participants and broadcast it
    setParticipantState('question');
    document.dispatchEvent(new Event('gamestatechange'));

    // Reset shrunk state and data for a new question
    questionContainer.classList.remove('shrunk');
    answerContainer.classList.remove('shrunk');
    delete gameScreen.dataset.isCramped; // Reset cramped state flag
    delete gameScreen.dataset.victoryType; // Reset victory type for new question
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
    answerLinkBtn.classList.add('hidden');
    victoryBoxBtn.classList.add('hidden');
    passQuestionModalOverlay.classList.add('hidden');
    undoAnswerChoiceBtn.classList.add('hidden');
    
    // Set default focus on the stop button for accessibility
    stopGameBtn.focus();
    
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

    // --- INSTANT TIMER RESET ---
    // 1. Remove the transition to prevent animating from the previous state.
    timerProgressRing.style.transition = 'none';

    // 2. Set the ring to its full initial state immediately.
    updateRing(timeLeft, startTime);

    // 3. Defer re-enabling the transition until after the browser has painted the initial state.
    // Using setTimeout with a 0ms delay is a reliable way to do this.
    setTimeout(() => {
        timerProgressRing.style.transition = 'stroke-dashoffset 1s linear, stroke 0.5s ease-in-out';
    }, 0);
    // --- END OF INSTANT TIMER RESET ---

    timerInterval = setInterval(() => {
        timeLeft--;
        timerValue.textContent = timeLeft;
        updateRing(timeLeft, startTime); // Update animation every second
        
        // Update state and broadcast to participants every second
        setTimerState(timeLeft, startTime);
        document.dispatchEvent(new Event('gamestatechange'));


        // Play tick sound every second until the end.
        if (timeLeft > 0) {
            playSound('timerTick');
        }

        // Add low-time warning visual cue
        if (timeLeft <= 5) {
            if (!timerContainer.classList.contains('low-time')) {
                timerContainer.classList.add('low-time');
            }
        }

        if (timeLeft <= 0) {
            playSound('gong');
            // Behave as if "Stop" was clicked, allowing for manual grading.
            triggerManualGrading(); // This will also stop the timer and clear state
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
        triggerManualGrading();
    });

    correctAnswerBtn.addEventListener('click', () => {
        playSound('correct');
        const currentQuestion = getCurrentQuestion();
        answerText.textContent = currentQuestion.a;
        answerContainer.classList.remove('hidden');
        answerLinkBtn.classList.toggle('hidden', !currentQuestion.url);

        answerControls.classList.add('hidden');
        victoryBoxBtn.classList.remove('hidden');
        victoryBoxBtn.focus();
        undoAnswerChoiceBtn.classList.remove('hidden');

        // Set state for participants to show the correct answer and a message
        setParticipantState('correctAnswer');
        document.dispatchEvent(new Event('gamestatechange'));

        // Check if this was a passed question to determine victory type
        if (getIsQuestionPassed()) {
            gameScreen.dataset.victoryType = 'half';
        } else {
            delete gameScreen.dataset.victoryType;
        }

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
        playSound('incorrect');
        answerControls.classList.add('hidden');
        failureControls.classList.remove('hidden');
        undoAnswerChoiceBtn.classList.remove('hidden');

        setParticipantState('incorrectAnswer');
        document.dispatchEvent(new Event('gamestatechange'));

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
        answerLinkBtn.classList.add('hidden');

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
            answerLinkBtn.classList.toggle('hidden', !currentQuestion.url);
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
            
            // Notify participants that it's learning time
            setParticipantState('learningTime');
            document.dispatchEvent(new Event('gamestatechange'));
        } else {
            // Second click: Proceed to the boxes screen
            if (onQuestionCompleteCallback) {
                onQuestionCompleteCallback();
            }
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
                // Add attributes for accessibility and keyboard navigation
                teamElement.setAttribute('role', 'button');
                teamElement.setAttribute('tabindex', '0');
                passQuestionTeamsContainer.appendChild(teamElement);
            }
        });

        passQuestionModalOverlay.classList.remove('hidden');
    });

    closePassQuestionModalBtn.addEventListener('click', () => {
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
        if (onQuestionCompleteCallback) {
            onQuestionCompleteCallback();
        }
        const victoryType = gameScreen.dataset.victoryType;
        if (victoryType === 'half') {
            showBoxesScreen({ mode: 'half-victory' });
        } else {
            showBoxesScreen({ mode: 'victory' });
        }
    });

    answerLinkBtn.addEventListener('click', () => {
        const url = getCurrentQuestion().url;
        if (url) {
            showLinkModal(url);
        }
    });
}