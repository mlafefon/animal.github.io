



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
let currentBetAmount = 0;


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
                img.src = boxesData.selectedScore < 0 ? IMAGE_URLS.CHEST_BROKEN : IMAGE_URLS