












// This file will handle the logic for the participant's view.
// It will communicate with the host's tab via Appwrite Realtime.

import { initializeNotification, showNotification } from './js/ui.js';
import { getGameSession, subscribeToSessionUpdates, sendAction, unsubscribeAllRealtime } from './js/appwriteService.js';
import { IMAGE_URLS } from './js/assets.js';


// --- DOM Elements ---
const screens = {
    join: document.getElementById('join-screen'),
    teamSelect: document.getElementById('team-select-screen'),
    game: document.getElementById('participant-game-screen'),
    boxes: document.getElementById('participant-boxes-screen'),
    betting: document.getElementById('participant-betting-screen')
};
const joinForm = document.getElementById('join-form');
const gameCodeInput = document.getElementById('game-code-input');
const joinError = document.getElementById('join-error');
const teamSelectionGrid = document.getElementById('team-selection-grid');
const teamSelectGameName = document.getElementById('team-select-game-name');
const teamSelectError = document.getElementById('team-select-error');
const myTeamIcon = document.getElementById('my-team-icon');
const myTeamName = document.getElementById('my-team-name');
const questionContainer = document.getElementById('question-container');
const participantControls = document.getElementById('participant-controls');
const stopBtn = document.getElementById('participant-stop-btn');
const waitingMessage = document.getElementById('waiting-message');
const versionElement = document.querySelector('.app-version');
const participantTimerContainer = document.getElementById('participant-timer-container');
const participantTimerValue = document.getElementById('participant-timer-value');
const participantTimerProgressRing = document.getElementById('participant-timer-progress-ring');

// Betting Elements
const participantBetAmount = document.getElementById('participant-bet-amount');
const participantBetIncrease = document.getElementById('participant-bet-increase');
const participantBetDecrease = document.getElementById('participant-bet-decrease');
const participantMaxBetLabel = document.getElementById('participant-max-bet-label');
const participantLockBetBtn = document.getElementById('participant-lock-bet-btn');
const participantBetStatus = document.getElementById('participant-bet-status');
const betControlContainer = document.querySelector('.bet-control-container');

// Final Answer Elements
const finalAnswerInputInteraction = document.getElementById('final-answer-interaction');
const finalAnswerInput = document.getElementById('final-answer-input');
const submitFinalAnswerBtn = document.getElementById('submit-final-answer-btn');
const finalAnswerSentMsg = document.getElementById('final-answer-sent-msg');


// --- State ---
// Get participantId from sessionStorage or create a new one. This persists across refreshes.
let participantId = sessionStorage.getItem('participantId');
if (!participantId) {
    participantId = `participant_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('participantId', participantId);
}
let myTeam = null;
let gameCode = null;
let currentHostState = null;
let sessionDocumentId = null;
let participantTimerInterval = null;
let wakeLockSentinel = null; // For Screen Wake Lock API

// Local Betting State
let currentBetValue = 0;
let wasBetLocked = false;


// --- Utility Functions ---

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
    if (versionElement) {
        versionElement.classList.toggle('hidden', screenName !== 'join');
    }
}

// --- Screen Wake Lock ---

/**
 * Manages the screen wake lock.
 * 'request' tries to acquire the lock.
 * 'release' releases the lock.
 * @param {'request' | 'release'} action The action to perform.
 */
const manageWakeLock = async (action) => {
    if (!('wakeLock' in navigator)) {
        console.log('Screen Wake Lock API not supported.');
        return;
    }

    if (action === 'request') {
        try {
            if (!wakeLockSentinel) {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
                wakeLockSentinel.addEventListener('release', () => {
                    console.log('Screen Wake Lock was released by the system.');
                    wakeLockSentinel = null;
                });
            }
        } catch (err) {
            console.error(`Failed to acquire wake lock: ${err.name}, ${err.message}`);
            wakeLockSentinel = null;
        }
    } else if (action === 'release') {
        if (wakeLockSentinel) {
            await wakeLockSentinel.release();
            wakeLockSentinel = null;
            console.log('Screen Wake Lock released.');
        }
    }
};


// --- Timer Functions ---

function stopParticipantTimer() {
    if (participantTimerInterval) {
        clearInterval(participantTimerInterval);
        participantTimerInterval = null;
    }
    if(participantTimerContainer){
        participantTimerContainer.classList.add('hidden');
        participantTimerContainer.classList.remove('low-time');
    }
}

/**
 * Starts the participant's timer and progress ring animation.
 * @param {number} startTime The number of seconds remaining to count down from.
 * @param {number} totalDuration The original total duration of the timer (for progress ring calculation).
 */
function startParticipantTimer(startTime, totalDuration) {
    stopParticipantTimer(); // Ensure any existing timer is stopped
    if(!participantTimerContainer) return;

    const initialDuration = totalDuration || startTime; // Fallback if total isn't provided

    participantTimerContainer.classList.remove('hidden');
    let timeLeft = startTime;
    participantTimerValue.textContent = timeLeft;

    const radius = participantTimerProgressRing.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    participantTimerProgressRing.style.strokeDasharray = `${circumference} ${circumference}`;

    const updateRing = (current, total) => {
        const progress = Math.max(0, current / total);
        const offset = circumference - progress * circumference;
        participantTimerProgressRing.style.strokeDashoffset = offset;
    };

    participantTimerProgressRing.style.transition = 'none';
    updateRing(timeLeft, initialDuration); // Use initialDuration for ring calculation
    setTimeout(() => {
        participantTimerProgressRing.style.transition = 'stroke-dashoffset 1s linear, stroke 0.5s ease-in-out';
    }, 10);

    participantTimerInterval = setInterval(() => {
        timeLeft--;
        participantTimerValue.textContent = timeLeft;
        updateRing(timeLeft, initialDuration); // Use initialDuration for ring calculation

        if (timeLeft <= 5) {
            participantTimerContainer.classList.add('low-time');
        }

        if (timeLeft <= 0) {
            stopParticipantTimer();
            // The timer just stops on the participant side. The host controls the state change.
        }
    }, 1000);
}


// --- Screen Initialization ---

function renderTeamSelectScreen(state) {
    teamSelectGameName.textContent = state.gameName;
    teamSelectionGrid.innerHTML = '';

    state.teams.forEach(team => {
        const teamElement = document.createElement('div');
        teamElement.className = 'team-member';
        teamElement.dataset.index = team.index;
        teamElement.innerHTML = `
            <div class="team-icon">
                <img src="${IMAGE_URLS[team.iconKey]}" alt="${team.name}">
            </div>
            <p class="team-name">${team.name}</p>
        `;
        
        if (team.isTaken) {
            teamElement.classList.add('taken');
            teamElement.title = "קבוצה זו תפוסה";
        } else {
            teamElement.addEventListener('click', () => handleTeamSelection(team.index));
        }
        
        teamSelectionGrid.appendChild(teamElement);
    });
}

async function handleTeamSelection(teamIndex) {
    const selectedTeamData = currentHostState.teams.find(t => t.index === teamIndex);

    if (!selectedTeamData || selectedTeamData.isTaken) {
        teamSelectError.textContent = 'קבוצה זו נתפסה. אנא בחר קבוצה אחרת.';
        teamSelectError.classList.remove('hidden');
        return;
    }

    // --- Optimistic UI Update ---
    // 1. Set myTeam object
    myTeam = {
        ...selectedTeamData,
        icon: IMAGE_URLS[selectedTeamData.iconKey]
    };
    
    // 2. Update my info display (for the next screen)
    myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
    myTeamIcon.src = myTeam.icon;
    
    // 3. Switch to the game screen with a waiting message
    showScreen('game');
    questionContainer.innerHTML = `<p id="participant-question-text">הצטרפת לקבוצת ${myTeam.name}! ממתין למנחה שיתחיל את המשחק...</p>`;
    participantControls.classList.add('hidden');
    waitingMessage.classList.add('hidden');

    // 4. Send the action to the host
    try {
        await sendAction(gameCode, {
            type: 'selectTeam',
            teamIndex: teamIndex,
            participantId: participantId
        });
        // On success, save the session details for potential rejoin
        sessionStorage.setItem('activeGame', JSON.stringify({
            gameCode: gameCode,
            teamIndex: myTeam.index
        }));
    } catch (error) {
        // --- Revert UI on error ---
        showNotification('שגיאה בבחירת קבוצה. נסה שוב.', 'error');
        myTeam = null; // Unset team
        showScreen('teamSelect'); // Go back
        renderTeamSelectScreen(currentHostState); // Re-render the grid with latest data
    }
}


/**
 * Renders the treasure boxes screen for the participant based on the host's state.
 * @param {object} state The current game state from the host.
 */
function renderBoxesScreen(state) {
    const titleEl = document.getElementById('participant-boxes-title');
    const msgEl = document.getElementById('participant-boxes-message');
    const container = document.getElementById('participant-chests-container');
    container.innerHTML = '';

    const { boxesData } = state;
    if (!boxesData) return;

    // Set title based on mode
    if (boxesData.mode === 'failure') titleEl.textContent = 'תיבת כישלון';
    else if (boxesData.mode === 'half-victory') titleEl.textContent = 'חצי תיבת נצחון';
    else titleEl.textContent = 'תיבת נצחון';

    const hasSelection = boxesData.selectedIndex !== null;

    // Create 3 chests
    for (let i = 0; i < 3; i++) {
        const chest = document.createElement('div');
        chest.className = 'treasure-chest';
        chest.dataset.index = i;
        
        const img = document.createElement('img');
        img.src = IMAGE_URLS.CHEST_CLOSED;
        
        const span = document.createElement('span');
        span.textContent = i + 1;

        chest.appendChild(img);
        chest.appendChild(span);
        container.appendChild(chest);

        if (hasSelection) {
            chest.querySelector('span').style.display = 'none';
            const scoreDiv = document.createElement('div');
            scoreDiv.className = 'score-reveal-above';
            scoreDiv.textContent = `\u200e${boxesData.scores[i]}`;
            chest.appendChild(scoreDiv);

            if (i === boxesData.selectedIndex) {
                chest.classList.add('selected');
                scoreDiv.classList.add('selected-score');
                img.src = boxesData.selectedScore < 0 ? IMAGE_URLS.CHEST_BROKEN : IMAGE_URLS.CHEST_OPEN;
            } else {
                chest.classList.add('disabled');
            }
        } else {
            // Not yet selected, add click listener
            chest.addEventListener('click', () => handleParticipantChestSelection(i));
        }
    }

    if (hasSelection) {
        msgEl.textContent = `הניקוד שהתקבל: \u200e${boxesData.selectedScore} נקודות. ממתין למנחה...`;
    } else {
        msgEl.textContent = 'התור שלך! בחר תיבת אוצר.';
    }
}

/**
 * Handles the participant's click on a treasure chest, sending the choice to the host.
 * @param {number} index The index (0, 1, or 2) of the selected chest.
 */
async function handleParticipantChestSelection(index) {
    // Disable all chests immediately to prevent multiple clicks
    document.querySelectorAll('#participant-chests-container .treasure-chest').forEach(c => {
        c.style.pointerEvents = 'none';
    });

    try {
        await sendAction(gameCode, {
            type: 'selectChest',
            chestIndex: index,
            teamIndex: myTeam.index,
            participantId: participantId
        });
        // The host will get this and broadcast the new state with the selection revealed.
        // The realtime listener will then call updateGameView -> renderBoxesScreen to show the result.
    } catch (e) {
        showNotification('שגיאה בבחירת התיבה.', 'error');
        // Re-enable on error
        document.querySelectorAll('#participant-chests-container .treasure-chest').forEach(c => {
            c.style.pointerEvents = 'auto';
        });
    }
}

/**
 * Renders the betting screen for the participant.
 */
function renderBettingScreen(state) {
    if (!myTeam) return;
    
    const teamData = state.teams.find(t => t.index === myTeam.index);
    if (!teamData) return;
    
    const currentScore = teamData.score;
    participantMaxBetLabel.textContent = `מקסימום להימור: ${currentScore}`;
    
    // Check if already locked from server state
    const bettingData = state.bettingData;
    const isLocked = bettingData && bettingData.lockedBets && bettingData.lockedBets[myTeam.index];
    
    if (isLocked) {
        betControlContainer.classList.add('hidden');
        participantLockBetBtn.classList.add('hidden');
        participantBetStatus.classList.remove('hidden');
        participantBetStatus.textContent = `ההימור התקבל: ${bettingData.currentBets[myTeam.index] || 0}`;
    } else {
        betControlContainer.classList.remove('hidden');
        participantLockBetBtn.classList.remove('hidden');
        participantBetStatus.classList.add('hidden');
        
        // If the bet was previously locked and now unlocked, check for reset from server.
        // If the server value is 0 (reset) and we were previously locked, reset local value.
        if (wasBetLocked && !isLocked && (bettingData.currentBets[myTeam.index] || 0) === 0) {
            currentBetValue = 0;
        }
        
        // Initialize local bet value to 0 if new (undefined)
        if (currentBetValue === undefined) currentBetValue = 0;
        participantBetAmount.textContent = currentBetValue;
        
        // Disable confirm if score is 0
        participantLockBetBtn.disabled = (currentScore <= 0 && currentBetValue > 0) || currentScore < 0; // Edge case for negative score
    }
    
    wasBetLocked = !!isLocked;
}

async function handleBetSubmission() {
    if (!myTeam) return;
    
    participantLockBetBtn.disabled = true;
    
    try {
        await sendAction(gameCode, {
            type: 'submitBet',
            teamIndex: myTeam.index,
            amount: currentBetValue,
            participantId: participantId
        });
        
        // UI Update to locked state immediately for responsiveness
        betControlContainer.classList.add('hidden');
        participantLockBetBtn.classList.add('hidden');
        participantBetStatus.classList.remove('hidden');
        participantBetStatus.textContent = 'שולח...';
        wasBetLocked = true; // Optimistic update
        
    } catch (e) {
        showNotification('שגיאה בשליחת ההימור.', 'error');
        participantLockBetBtn.disabled = false;
    }
}

/**
 * Handles sending the final answer text to the host.
 */
async function handleFinalAnswerSubmission() {
    if (!myTeam) return;
    const answerText = finalAnswerInput.value.trim();
    if (!answerText) {
        showNotification('יש לכתוב תשובה לפני השליחה', 'error');
        return;
    }

    submitFinalAnswerBtn.disabled = true;

    try {
        await sendAction(gameCode, {
            type: 'submitFinalAnswer',
            teamIndex: myTeam.index,
            answerText: answerText,
            participantId: participantId
        });

        // Update local UI
        finalAnswerInputInteraction.classList.add('hidden');
        finalAnswerSentMsg.classList.remove('hidden');

    } catch (e) {
        showNotification('שגיאה בשליחת התשובה.', 'error');
        submitFinalAnswerBtn.disabled = false;
    }
}


function updateGameView(state) {
    currentHostState = state; // Update global state

    // If the game is over, reset the view to the join screen
    if (state.gameState === 'finished') {
        manageWakeLock('release'); // Release the lock on game end
        unsubscribeAllRealtime();
        sessionStorage.removeItem('activeGame');
        sessionStorage.removeItem('participantId');
        showNotification('המשחק הסתיים. תודה שהשתתפתם!', 'success');
        setTimeout(() => window.location.reload(), 3000);
        return;
    }

    // This logic runs if the participant has NOT yet chosen a team.
    // It keeps the team selection screen up-to-date.
    if (!myTeam) {
        manageWakeLock('release'); // Not in game yet, ensure lock is off
        renderTeamSelectScreen(state);
        showScreen('teamSelect');
        return;
    }
    
    // VERIFY SELECTION: Check if I am still part of my team.
    const myTeamInNewState = state.teams.find(t => t.index === myTeam.index);
    if (!myTeamInNewState || myTeamInNewState.participantId !== participantId) {
        // I have been kicked by the host, or my selection was pre-empted.
        myTeam = null;
        manageWakeLock('release'); // Release lock as we're kicked
        unsubscribeAllRealtime();
        sessionStorage.removeItem('activeGame');

        showNotification('החיבור לקבוצה בוטל. יש להצטרף למשחק מחדש.', 'info');
        
        // Go back to the initial join screen
        showScreen('join');
        gameCodeInput.value = '';
        joinError.classList.add('hidden');
        return; // Stop processing this state update.
    }

    // This logic runs AFTER the participant has chosen a team.
    
    // Use == to protect against potential type mismatch (string vs number) from state updates.
    const isMyTurn = state.activeTeamIndex == myTeam.index;
    const activeTeam = state.teams.find(t => t.index === state.activeTeamIndex);
    const activeTeamName = activeTeam ? activeTeam.name : 'הקבוצה';

    // Default UI state: hide controls and waiting messages.
    participantControls.classList.add('hidden');
    waitingMessage.classList.add('hidden');
    
    // Hide final answer elements by default
    finalAnswerInputInteraction.classList.add('hidden');
    finalAnswerSentMsg.classList.add('hidden');

    stopParticipantTimer(); // Stop timer by default for every state change
    
    // In an active game state, request the wake lock
    manageWakeLock('request');

    switch (state.gameState) {
        case 'betting':
            showScreen('betting');
            renderBettingScreen(state);
            break;
            
        case 'finalRoundPre':
            showScreen('game');
            questionContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <h1 style="color: #ffeb3b; font-size: 4rem; text-align: center;">הסיבוב האחרון!</h1>
                </div>
            `;
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
            break;
        
        case 'finalQuestion':
            showScreen('game');
            questionContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
                    <h2 style="color: #ffeb3b; margin-bottom: 1.5rem;">שאלת הסיכום</h2>
                    <p id="participant-question-text" style="font-size: 1.8rem; white-space: pre-wrap;">${state.currentQuestionData ? state.currentQuestionData.q : '...'}</p>
                </div>
            `;
            
            // Check if my team has already submitted an answer
            const hasSubmitted = state.finalAnswers && state.finalAnswers[myTeam.index];
            
            if (hasSubmitted) {
                finalAnswerSentMsg.classList.remove('hidden');
            } else {
                finalAnswerInputInteraction.classList.remove('hidden');
                submitFinalAnswerBtn.disabled = false; // Ensure button is active
            }
            
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
            break;

        case 'learningTime':
            showScreen('game');
            questionContainer.innerHTML = `
                <div style="line-height: 1.6; text-align: center;">
                    <p style="font-size: 2.2rem; font-weight: bold; margin-bottom: 1.5rem;">זמן למידה:</p>
                    <p id="participant-question-text" style="font-size: 1.8rem; color: #ffeb3b;">${state.currentQuestionData.a}</p>
                </div>
            `;
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
            break;
            
        case 'incorrectAnswer':
            showScreen('game');
            const activeTeamForIncorrect = state.teams.find(t => t.index === state.activeTeamIndex);
            if (activeTeamForIncorrect) {
                const isMyTeamIncorrect = myTeam && myTeam.index === activeTeamForIncorrect.index;
                const sadIcon = `
                    <svg xmlns="http://www.w3.org/2000/svg" height="80px" viewBox="0 0 24 24" width="80px" fill="#FF5252" style="margin-bottom: 1rem;">
                        <path d="M0 0h24v24H0V0z" fill="none"/>
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7zM9 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                    </svg>
                `;
                const choiceMessage = isMyTeamIncorrect 
                    ? 'במה תבחרו?' 
                    : `במה ${activeTeamForIncorrect.name} יבחרו?`;

                questionContainer.innerHTML = `
                    <div style="line-height: 1.6; display: flex; flex-direction: column; align-items: center;">
                        ${sadIcon}
                        <p style="font-size: 2.2rem; color: #FF5252; font-weight: bold;">תשובה שגויה</p>
                        <p>${choiceMessage}</p>
                    </div>
                `;
            } else {
                 questionContainer.innerHTML = `<p id="participant-question-text">תשובה שגויה</p>`;
            }
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
            break;

        case 'correctAnswer':
            showScreen('game');
            const activeTeamForCorrect = state.teams.find(t => t.index === state.activeTeamIndex);
            const isMyTeamCorrect = myTeam && activeTeamForCorrect && myTeam.index === activeTeamForCorrect.index;
        
            if (activeTeamForCorrect) {
                const messageHtml = `
                    <div style="line-height: 1.6; text-align: center;">
                        <p style="font-size: 2.2rem; color: #4CAF50; font-weight: bold;">
                            כל הכבוד ${isMyTeamCorrect ? `קבוצת ${activeTeamForCorrect.name}` : `לקבוצת ${activeTeamForCorrect.name}`}!
                        </p>
                        <p>${isMyTeamCorrect ? 'עניתם' : 'הם ענו'} תשובה נכונה.</p>
                        <p style="margin-top: 1rem; font-style: italic;">עכשיו זמן למידה...</p>
                        <hr style="margin: 1.25rem auto; width: 80%; border-color: rgba(255,255,255,0.2);">
                        <p id="participant-question-text" style="font-size: 1.8rem; color: #ffeb3b; font-weight: bold;">${state.currentQuestionData.a}</p>
                    </div>
                `;
                questionContainer.innerHTML = messageHtml;
            } else {
                 questionContainer.innerHTML = `<p id="participant-question-text">תשובה נכונה! התשובה היא: ${state.currentQuestionData.a}</p>`;
            }
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
            break;

        case 'question':
            showScreen('game');
            questionContainer.innerHTML = `<p id="participant-question-text">${state.currentQuestionData.q}</p>`;
            if (isMyTurn) {
                participantControls.classList.remove('hidden');
                stopBtn.disabled = false; // Ensure button is enabled for new question
            } else {
                const otherTeamMessage = `התור של קבוצת ${activeTeamName}.`;
                waitingMessage.querySelector('p').textContent = otherTeamMessage;
                waitingMessage.classList.remove('hidden');
            }
            if (state.currentQuestionData && state.currentQuestionData.timerEndTime) {
                const remainingTime = Math.max(0, Math.round((state.currentQuestionData.timerEndTime - Date.now()) / 1000));
                startParticipantTimer(remainingTime, state.currentQuestionData.timer);
            } else if (state.currentQuestionData && state.currentQuestionData.timer) {
                // Fallback for older state structure or if endTime is missing
                startParticipantTimer(state.currentQuestionData.timer, state.currentQuestionData.timer);
            }
            break;

        case 'grading':
            showScreen('game');
            if (isMyTurn) {
                questionContainer.innerHTML = `<p id="participant-question-text">עצרתם את הטיימר. מה היא תשובתכם?</p>`;
            } else {
                questionContainer.innerHTML = `<p id="participant-question-text">המנחה בודק את התשובה של קבוצת ${activeTeamName}...</p>`;
            }
            break;
            
        case 'boxes':
            if (isMyTurn) {
                showScreen('boxes');
                renderBoxesScreen(state);
            } else {
                showScreen('game');
                questionContainer.innerHTML = `<p id="participant-question-text">ממתין לקבוצת ${activeTeamName} לבחור תיבת אוצר...</p>`;
            }
            break;
            
        case 'boxes-revealed':
            if (isMyTurn) {
                showScreen('boxes');
                renderBoxesScreen(state);
            } else {
                showScreen('game');
                const score = state.boxesData.selectedScore;
                questionContainer.innerHTML = `<p id="participant-question-text">קבוצת ${activeTeamName} קיבלה \u200e${score} נקודות. ממתין למנחה...</p>`;
            }
            break;
        
        case 'setup':
            showScreen('game');
            questionContainer.innerHTML = `<p id="participant-question-text">המשחק יתחיל בקרוב...</p>`;
            break;

        case 'waiting':
        default:
            showScreen('game');
            if (isMyTurn) {
                questionContainer.innerHTML = `<p id="participant-question-text">מוכנים? השאלה הבאה אליכם</p>`;
            } else {
                questionContainer.innerHTML = `<p id="participant-question-text">התור הבא הוא של קבוצת ${activeTeamName}. השאלה תופיע בקרוב...</p>`;
            }
            break;
    }
}

function initializeJoinScreen() {
    joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = gameCodeInput.value.trim();
        if (!code || code.length !== 6) {
            joinError.textContent = 'יש להזין קוד משחק בן 6 ספרות.';
            joinError.classList.remove('hidden');
            return;
        }

        try {
            const sessionDoc = await getGameSession(code);
            if (!sessionDoc) {
                joinError.textContent = 'קוד המשחק שהוזן אינו תקין או שהמשחק לא התחיל.';
                joinError.classList.remove('hidden');
                return;
            }
            
            // Check if the game session has expired (older than 3 hours)
            const createdAt = new Date(sessionDoc.$createdAt);
            const now = new Date();
            const threeHoursInMillis = 3 * 60 * 60 * 1000;

            if (now - createdAt > threeHoursInMillis) {
                joinError.textContent = 'תוקף המשחק פג. אנא בקש מהמנחה קוד חדש.';
                joinError.classList.remove('hidden');
                gameCodeInput.value = ''; // Clear input for new code
                return;
            }

            gameCode = code;
            sessionDocumentId = sessionDoc.$id;
            const sessionData = JSON.parse(sessionDoc.sessionData);
            
            joinError.classList.add('hidden');
            
            // Subscribe to updates for this session
            subscribeToSessionUpdates(sessionDocumentId, (response) => {
                const updatedData = JSON.parse(response.payload.sessionData);
                updateGameView(updatedData);
            });
            
            // Initial render and switch to team select screen
            updateGameView(sessionData);
            showScreen('teamSelect');

        } catch (error) {
            console.error("Failed to join game:", error);
            joinError.textContent = 'אירעה שגיאה. בדוק את חיבור האינטרנט ונסה שוב.';
            joinError.classList.remove('hidden');
        }
    });
}

function initializeGameScreen() {
    stopBtn.addEventListener('click', async () => {
        // Disable button immediately to prevent multiple clicks
        stopBtn.disabled = true; 
        try {
            await sendAction(gameCode, {
                type: 'stopTimer',
                teamIndex: myTeam.index,
                participantId: participantId
            });
            // Host will receive this and update state, which will hide the button via the listener.
        } catch (error) {
            showNotification('שגיאה בשליחת הפעולה.', 'error');
            stopBtn.disabled = false; // Re-enable on error
        }
    });

    participantBetIncrease.addEventListener('click', () => {
        if (!myTeam) return;
        const maxBet = currentHostState.teams.find(t => t.index === myTeam.index)?.score || 0;
        if (currentBetValue + 5 <= maxBet) {
            currentBetValue += 5;
            participantBetAmount.textContent = currentBetValue;
        }
    });

    participantBetDecrease.addEventListener('click', () => {
        if (currentBetValue - 5 >= 0) {
            currentBetValue -= 5;
            participantBetAmount.textContent = currentBetValue;
        }
    });

    participantLockBetBtn.addEventListener('click', handleBetSubmission);
    
    // Listener for Final Answer
    submitFinalAnswerBtn.addEventListener('click', handleFinalAnswerSubmission);
}

/**
 * Checks sessionStorage for an active game and attempts to rejoin it.
 * @returns {Promise<boolean>} True if rejoin was successful, false otherwise.
 */
async function attemptRejoin() {
    const savedGameJSON = sessionStorage.getItem('activeGame');
    if (!savedGameJSON) {
        return false;
    }
    
    const savedGame = JSON.parse(savedGameJSON);
    const { gameCode: savedCode, teamIndex: savedTeamIndex } = savedGame;

    if (!savedCode) {
        sessionStorage.removeItem('activeGame');
        return false;
    }

    showScreen('join');
    joinError.textContent = 'מנסה להתחבר מחדש למשחק...';
    joinError.classList.remove('hidden');

    try {
        const sessionDoc = await getGameSession(savedCode);
        if (!sessionDoc) {
            throw new Error('המשחק כבר לא פעיל.');
        }

        const createdAt = new Date(sessionDoc.$createdAt);
        const now = new Date();
        const threeHoursInMillis = 3 * 60 * 60 * 1000;
        if (now - createdAt > threeHoursInMillis) {
            throw new Error('תוקף המשחק ששמרת פג.');
        }

        gameCode = savedCode;
        sessionDocumentId = sessionDoc.$id;
        const sessionData = JSON.parse(sessionDoc.sessionData);
        const myTeamInSession = sessionData.teams.find(t => t.index === savedTeamIndex);
        
        if (myTeamInSession && myTeamInSession.participantId === participantId) {
            joinError.classList.add('hidden');
            subscribeToSessionUpdates(sessionDocumentId, (response) => {
                const updatedData = JSON.parse(response.payload.sessionData);
                updateGameView(updatedData);
            });
            myTeam = { ...myTeamInSession, icon: IMAGE_URLS[myTeamInSession.iconKey] };
            myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
            myTeamIcon.src = myTeam.icon;
            updateGameView(sessionData);
            showNotification('התחברת מחדש בהצלחה!', 'success');
            return true; // SUCCESS
        } else {
            throw new Error('הקבוצה שלך כבר לא שמורה. אנא הצטרף מחדש.');
        }
    } catch (error) {
        sessionStorage.removeItem('activeGame');
        joinError.textContent = error.message || 'שגיאה בהתחברות מחדש.';
        joinError.classList.remove('hidden');
        setTimeout(() => {
            joinError.classList.add('hidden');
            gameCodeInput.value = '';
        }, 3500);
        return false; // FAILURE
    }
}


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    // A robust way to handle mobile viewport height changes
    const setViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', setViewportHeight);
    setViewportHeight(); // Initial call

    initializeNotification();
    initializeJoinScreen();
    initializeGameScreen();

    // Clean up subscriptions when the user closes the page
    window.addEventListener('beforeunload', () => {
        unsubscribeAllRealtime();
        manageWakeLock('release');
    });

    // Handle visibility changes to re-acquire wake lock if necessary
    document.addEventListener('visibilitychange', () => {
        if (wakeLockSentinel !== null && document.visibilityState === 'visible') {
            manageWakeLock('request');
        }
    });

    // --- New Join/Rejoin Logic ---
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    const savedGameJSON = sessionStorage.getItem('activeGame');
    const savedGame = savedGameJSON ? JSON.parse(savedGameJSON) : null;
    
    let successfullyRejoined = false;

    // Priority 1: A saved game session exists. Try to rejoin it,
    // unless the URL is for a different game.
    if (savedGame) {
        if (!codeFromUrl || codeFromUrl === savedGame.gameCode) {
            successfullyRejoined = await attemptRejoin();
        }
    }

    // Priority 2: If no successful rejoin, and there's a code in the URL, join it fresh.
    if (!successfullyRejoined && codeFromUrl && /^\d{6}$/.test(codeFromUrl)) {
        // Clear any old session storage that might conflict
        sessionStorage.removeItem('activeGame'); 

        gameCodeInput.value = codeFromUrl;
        joinError.textContent = 'מתחבר למשחק...';
        joinError.classList.remove('hidden');
        
        // Short delay to allow DOM to update before simulating submit.
        setTimeout(() => {
            // The submit event listener is in initializeJoinScreen
            joinForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 100);
    
    // Priority 3: No rejoin, no URL code. Just show the clean join screen.
    } else if (!successfullyRejoined) {
         showScreen('join');
    }

    // Fetch and display the app version
    fetch('metadata.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const version = data.version;
            if (version) {
                const versionElement = document.querySelector('.app-version');
                if (versionElement) {
                    versionElement.textContent = `גרסה ${version}`;
                }
            }
        })
        .catch(error => console.error('Error fetching app version:', error));
});