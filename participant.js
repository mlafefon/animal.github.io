

// This file will handle the logic for the participant's view.
// It will communicate with the host's tab via Appwrite Realtime.

import { initializeNotification, showNotification } from './js/ui.js';
import { getGameSession, subscribeToSessionUpdates, sendAction, unsubscribeAllRealtime, getAccount } from './js/appwriteService.js';
import { IMAGE_URLS } from './js/assets.js';


// --- DOM Elements ---
const screens = {
    join: document.getElementById('join-screen'),
    teamSelect: document.getElementById('team-select-screen'),
    game: document.getElementById('participant-game-screen'),
    boxes: document.getElementById('participant-boxes-screen'),
    hostRemote: document.getElementById('host-remote-screen')
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

// --- Host Remote DOM Elements ---
const remoteStatusText = document.getElementById('remote-status-text');
const remotePanels = {
    start: document.getElementById('remote-panel-start'),
    preQuestion: document.getElementById('remote-panel-pre-question'),
    question: document.getElementById('remote-panel-question'),
    grading: document.getElementById('remote-panel-grading'),
    correct: document.getElementById('remote-panel-correct'),
    incorrect: document.getElementById('remote-panel-incorrect'),
    boxes: document.getElementById('remote-panel-boxes'),
    boxesRevealed: document.getElementById('remote-panel-boxes-revealed'),
};

// --- State ---
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
let wakeLockSentinel = null;
let isHost = false; // <-- New state variable to track if the user is the host


// --- Utility Functions ---

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen && screen.classList.add('hidden'));
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
    if (versionElement) {
        versionElement.classList.toggle('hidden', screenName !== 'join');
    }
}

const manageWakeLock = async (action) => {
    if (!('wakeLock' in navigator)) return;
    if (action === 'request') {
        try {
            if (!wakeLockSentinel) {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
            }
        } catch (err) {
            console.error(`Wake Lock failed: ${err.name}, ${err.message}`);
            wakeLockSentinel = null;
        }
    } else if (action === 'release' && wakeLockSentinel) {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
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

function startParticipantTimer(startTime, totalDuration) {
    stopParticipantTimer();
    if(!participantTimerContainer) return;

    const initialDuration = totalDuration || startTime;
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
    updateRing(timeLeft, initialDuration);
    setTimeout(() => {
        participantTimerProgressRing.style.transition = 'stroke-dashoffset 1s linear, stroke 0.5s ease-in-out';
    }, 10);

    participantTimerInterval = setInterval(() => {
        timeLeft--;
        participantTimerValue.textContent = timeLeft;
        updateRing(timeLeft, initialDuration);
        if (timeLeft <= 5) participantTimerContainer.classList.add('low-time');
        if (timeLeft <= 0) stopParticipantTimer();
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
    myTeam = { ...selectedTeamData, icon: IMAGE_URLS[selectedTeamData.iconKey] };
    myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
    myTeamIcon.src = myTeam.icon;
    showScreen('game');
    questionContainer.innerHTML = `<p id="participant-question-text">הצטרפת לקבוצת ${myTeam.name}! ממתין למנחה שיתחיל את המשחק...</p>`;
    participantControls.classList.add('hidden');
    waitingMessage.classList.add('hidden');
    try {
        await sendAction(gameCode, { type: 'selectTeam', teamIndex, participantId });
        sessionStorage.setItem('activeGame', JSON.stringify({ gameCode, teamIndex: myTeam.index }));
    } catch (error) {
        showNotification('שגיאה בבחירת קבוצה. נסה שוב.', 'error');
        myTeam = null;
        showScreen('teamSelect');
        renderTeamSelectScreen(currentHostState);
    }
}

function renderBoxesScreen(state) {
    const titleEl = document.getElementById('participant-boxes-title');
    const msgEl = document.getElementById('participant-boxes-message');
    const container = document.getElementById('participant-chests-container');
    container.innerHTML = '';
    const { boxesData } = state;
    if (!boxesData) return;
    if (boxesData.mode === 'failure') titleEl.textContent = 'תיבת כישלון';
    else if (boxesData.mode === 'half-victory') titleEl.textContent = 'חצי תיבת נצחון';
    else titleEl.textContent = 'תיבת נצחון';
    const hasSelection = boxesData.selectedIndex !== null;
    for (let i = 0; i < 3; i++) {
        const chest = document.createElement('div');
        chest.className = 'treasure-chest';
        chest.dataset.index = i;
        chest.innerHTML = `<img src="${IMAGE_URLS.CHEST_CLOSED}"><span>${i + 1}</span>`;
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
                chest.querySelector('img').src = boxesData.selectedScore < 0 ? IMAGE_URLS.CHEST_BROKEN : IMAGE_URLS.CHEST_OPEN;
            } else {
                chest.classList.add('disabled');
            }
        } else {
            chest.addEventListener('click', () => handleParticipantChestSelection(i));
        }
    }
    msgEl.textContent = hasSelection ? `הניקוד שהתקבל: \u200e${boxesData.selectedScore} נקודות. ממתין למנחה...` : 'התור שלך! בחר תיבת אוצר.';
}

async function handleParticipantChestSelection(index) {
    document.querySelectorAll('#participant-chests-container .treasure-chest').forEach(c => { c.style.pointerEvents = 'none'; });
    try {
        await sendAction(gameCode, { type: 'selectChest', chestIndex: index, teamIndex: myTeam.index, participantId });
    } catch (e) {
        showNotification('שגיאה בבחירת התיבה.', 'error');
        document.querySelectorAll('#participant-chests-container .treasure-chest').forEach(c => { c.style.pointerEvents = 'auto'; });
    }
}

function handleRealtimeUpdate(response) {
    const updatedData = JSON.parse(response.payload.sessionData);
    if (isHost) {
        updateHostRemoteView(updatedData);
    } else {
        updateGameView(updatedData);
    }
}

function updateGameView(state) {
    currentHostState = state;
    if (state.gameState === 'finished') {
        manageWakeLock('release');
        unsubscribeAllRealtime();
        sessionStorage.removeItem('activeGame');
        sessionStorage.removeItem('participantId');
        showNotification('המשחק הסתיים. תודה שהשתתפתם!', 'success');
        setTimeout(() => window.location.reload(), 3000);
        return;
    }
    if (!myTeam) {
        manageWakeLock('release');
        renderTeamSelectScreen(state);
        showScreen('teamSelect');
        return;
    }
    const myTeamInNewState = state.teams.find(t => t.index === myTeam.index);
    if (!myTeamInNewState || myTeamInNewState.participantId !== participantId) {
        myTeam = null;
        manageWakeLock('release');
        unsubscribeAllRealtime();
        sessionStorage.removeItem('activeGame');
        showNotification('החיבור לקבוצה בוטל. יש להצטרף למשחק מחדש.', 'info');
        showScreen('join');
        gameCodeInput.value = '';
        joinError.classList.add('hidden');
        return;
    }
    const isMyTurn = state.activeTeamIndex == myTeam.index;
    const activeTeam = state.teams.find(t => t.index === state.activeTeamIndex);
    const activeTeamName = activeTeam ? activeTeam.name : 'הקבוצה';
    participantControls.classList.add('hidden');
    waitingMessage.classList.add('hidden');
    stopParticipantTimer();
    manageWakeLock('request');

    const stateHandlers = {
        'join': () => {
             showScreen('game');
             questionContainer.innerHTML = `<p id="participant-question-text">ממתין למנחה שיתחיל את המשחק...</p>`;
        },
        'learningTime': () => {
            showScreen('game');
            questionContainer.innerHTML = `<div style="line-height: 1.6; text-align: center;"><p style="font-size: 2.2rem; font-weight: bold; margin-bottom: 1.5rem;">זמן למידה:</p><p id="participant-question-text" style="font-size: 1.8rem; color: #ffeb3b;">${state.currentQuestionData.a}</p></div>`;
        },
        'incorrectAnswer': () => {
            showScreen('game');
            const team = state.teams[state.activeTeamIndex];
            const isMyTeam = myTeam && myTeam.index === team.index;
            questionContainer.innerHTML = `<div style="line-height: 1.6; display: flex; flex-direction: column; align-items: center;"><svg xmlns="http://www.w3.org/2000/svg" height="80px" viewBox="0 0 24 24" width="80px" fill="#FF5252" style="margin-bottom: 1rem;"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7zM9 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg><p style="font-size: 2.2rem; color: #FF5252; font-weight: bold;">תשובה שגויה</p><p>${isMyTeam ? 'במה תבחרו?' : `במה ${team.name} יבחרו?`}</p></div>`;
        },
        'correctAnswer': () => {
            showScreen('game');
            const team = state.teams[state.activeTeamIndex];
            const isMyTeam = myTeam && myTeam.index === team.index;
            questionContainer.innerHTML = `<div style="line-height: 1.6; text-align: center;"><p style="font-size: 2.2rem; color: #4CAF50; font-weight: bold;">כל הכבוד ${isMyTeam ? `קבוצת ${team.name}` : `לקבוצת ${team.name}`}!</p><p>${isMyTeam ? 'עניתם' : 'הם ענו'} תשובה נכונה.</p><p style="margin-top: 1rem; font-style: italic;">עכשיו זמן למידה...</p><hr style="margin: 1.25rem auto; width: 80%; border-color: rgba(255,255,255,0.2);"><p id="participant-question-text" style="font-size: 1.8rem; color: #ffeb3b; font-weight: bold;">${state.currentQuestionData.a}</p></div>`;
        },
        'question': () => {
            showScreen('game');
            questionContainer.innerHTML = `<p id="participant-question-text">${state.currentQuestionData.q}</p>`;
            if (isMyTurn) {
                participantControls.classList.remove('hidden');
                stopBtn.disabled = false;
            } else {
                waitingMessage.querySelector('p').textContent = `התור של קבוצת ${activeTeamName}.`;
                waitingMessage.classList.remove('hidden');
            }
            if (state.currentQuestionData && state.currentQuestionData.timerEndTime) {
                const remaining = Math.max(0, Math.round((state.currentQuestionData.timerEndTime - Date.now()) / 1000));
                startParticipantTimer(remaining, state.currentQuestionData.timer);
            }
        },
        'grading': () => {
            showScreen('game');
            questionContainer.innerHTML = `<p id="participant-question-text">${isMyTurn ? 'עצרתם את הטיימר. מה היא תשובתכם?' : `המנחה בודק את התשובה של קבוצת ${activeTeamName}...`}</p>`;
        },
        'boxes': () => {
            if (isMyTurn) { showScreen('boxes'); renderBoxesScreen(state); }
            else { showScreen('game'); questionContainer.innerHTML = `<p id="participant-question-text">ממתין לקבוצת ${activeTeamName} לבחור תיבת אוצר...</p>`; }
        },
        'boxes-revealed': () => {
            if (isMyTurn) { showScreen('boxes'); renderBoxesScreen(state); }
            else { showScreen('game'); questionContainer.innerHTML = `<p id="participant-question-text">קבוצת ${activeTeamName} קיבלה \u200e${state.boxesData.selectedScore} נקודות. ממתין למנחה...</p>`; }
        },
        'setup': () => {
            showScreen('game');
            questionContainer.innerHTML = `<p id="participant-question-text">המשחק יתחיל בקרוב...</p>`;
        },
        'waiting': () => {
            showScreen('game');
            questionContainer.innerHTML = `<p id="participant-question-text">${isMyTurn ? 'מוכנים? השאלה הבאה אליכם' : `התור הבא הוא של קבוצת ${activeTeamName}. השאלה תופיע בקרוב...`}</p>`;
        },
    };

    (stateHandlers[state.gameState] || stateHandlers['waiting'])();
}

// --- Host Remote Functions ---
function updateHostRemoteView(state) {
    currentHostState = state;
    Object.values(remotePanels).forEach(p => p.classList.add('hidden'));

    const stateToPanelMap = {
        'join': 'start',
        'setup': 'start',
        'waiting': 'preQuestion',
        'question': 'question',
        'grading': 'grading',
        'correctAnswer': 'correct',
        'incorrectAnswer': 'incorrect',
        'boxes': 'boxes',
        'boxes-revealed': 'boxesRevealed'
    };
    
    const panelKey = stateToPanelMap[state.gameState] || 'preQuestion';
    if(remotePanels[panelKey]) {
        remotePanels[panelKey].classList.remove('hidden');
    }
    
    const activeTeam = state.teams[state.activeTeamIndex];
    remoteStatusText.textContent = `התור של: ${activeTeam ? activeTeam.name : '...'}`;
}

function initializeHostRemote(initialState) {
    showScreen('hostRemote');
    updateHostRemoteView(initialState);
    
    const remoteActions = {
        'remote-start-game-btn': { type: 'host_action', action: 'startGame' },
        'remote-next-question-btn': { type: 'host_action', action: 'nextQuestion' },
        'remote-stop-timer-btn': { type: 'host_action', action: 'stopTimer' },
        'remote-correct-btn': { type: 'host_action', action: 'gradeAnswer', correct: true },
        'remote-incorrect-btn': { type: 'host_action', action: 'gradeAnswer', correct: false },
        'remote-victory-box-btn': { type: 'host_action', action: 'showVictoryBox' },
        'remote-failure-box-btn': { type: 'host_action', action: 'showFailureBox' },
        'remote-pass-question-btn': { type: 'host_action', action: 'passQuestion' },
        'remote-return-btn': { type: 'host_action', action: 'continueFromBoxes' }
    };
    
    Object.entries(remoteActions).forEach(([btnId, action]) => {
        document.getElementById(btnId)?.addEventListener('click', () => sendAction(gameCode, action));
    });

    remotePanels.boxes.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const chestIndex = parseInt(btn.dataset.chest, 10);
            sendAction(gameCode, { type: 'host_action', action: 'selectChest', chestIndex });
        });
    });
}


// --- Main Initialization ---

async function attemptRejoin() {
    const savedGameJSON = sessionStorage.getItem('activeGame');
    if (!savedGameJSON) return false;
    const savedGame = JSON.parse(savedGameJSON);
    if (!savedGame.gameCode) {
        sessionStorage.removeItem('activeGame');
        return false;
    }
    showScreen('join');
    joinError.textContent = 'מנסה להתחבר מחדש למשחק...';
    joinError.classList.remove('hidden');
    try {
        const sessionDoc = await getGameSession(savedGame.gameCode);
        if (!sessionDoc) throw new Error('המשחק כבר לא פעיל.');
        const createdAt = new Date(sessionDoc.$createdAt);
        if (new Date() - createdAt > 3 * 60 * 60 * 1000) throw new Error('תוקף המשחק ששמרת פג.');
        gameCode = savedGame.gameCode;
        sessionDocumentId = sessionDoc.$id;
        const sessionData = JSON.parse(sessionDoc.sessionData);
        const myTeamInSession = sessionData.teams.find(t => t.index === savedGame.teamIndex);
        if (myTeamInSession && myTeamInSession.participantId === participantId) {
            joinError.classList.add('hidden');
            subscribeToSessionUpdates(sessionDocumentId, handleRealtimeUpdate);
            myTeam = { ...myTeamInSession, icon: IMAGE_URLS[myTeamInSession.iconKey] };
            myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
            myTeamIcon.src = myTeam.icon;
            updateGameView(sessionData);
            showNotification('התחברת מחדש בהצלחה!', 'success');
            return true;
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
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const setViewportHeight = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    window.addEventListener('resize', setViewportHeight);
    setViewportHeight();
    initializeNotification();

    joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = gameCodeInput.value.trim();
        if (!/^\d{6}$/.test(code)) {
            joinError.textContent = 'יש להזין קוד משחק בן 6 ספרות.';
            joinError.classList.remove('hidden');
            return;
        }
        try {
            const sessionDoc = await getGameSession(code);
            if (!sessionDoc) {
                joinError.textContent = 'קוד המשחק שהוזן אינו תקין.';
                joinError.classList.remove('hidden');
                return;
            }
            if (new Date() - new Date(sessionDoc.$createdAt) > 3 * 60 * 60 * 1000) {
                joinError.textContent = 'תוקף המשחק פג. בקש מהמנחה קוד חדש.';
                joinError.classList.remove('hidden');
                return;
            }
            gameCode = code;
            sessionDocumentId = sessionDoc.$id;
            const sessionData = JSON.parse(sessionDoc.sessionData);
            joinError.classList.add('hidden');

            try {
                const user = await getAccount();
                if (user && user.$id === sessionDoc.hostId) {
                    isHost = true;
                    subscribeToSessionUpdates(sessionDocumentId, handleRealtimeUpdate);
                    initializeHostRemote(sessionData);
                    return;
                }
            } catch (authError) { /* Not logged in, proceed as participant */ }
            
            isHost = false;
            subscribeToSessionUpdates(sessionDocumentId, handleRealtimeUpdate);
            updateGameView(sessionData);
            showScreen('teamSelect');
        } catch (error) {
            console.error("Failed to join game:", error);
            joinError.textContent = 'אירעה שגיאה. בדוק את חיבור האינטרנט ונסה שוב.';
            joinError.classList.remove('hidden');
        }
    });

    initializeGameScreen();
    window.addEventListener('beforeunload', () => { unsubscribeAllRealtime(); manageWakeLock('release'); });
    document.addEventListener('visibilitychange', () => { if (wakeLockSentinel && document.visibilityState === 'visible') manageWakeLock('request'); });

    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    const savedGame = JSON.parse(sessionStorage.getItem('activeGame') || 'null');
    let successfullyRejoined = false;
    if (savedGame && (!codeFromUrl || codeFromUrl === savedGame.gameCode)) {
        successfullyRejoined = await attemptRejoin();
    }
    if (!successfullyRejoined && codeFromUrl && /^\d{6}$/.test(codeFromUrl)) {
        sessionStorage.removeItem('activeGame');
        gameCodeInput.value = codeFromUrl;
        joinError.textContent = 'מתחבר למשחק...';
        joinError.classList.remove('hidden');
        setTimeout(() => joinForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })), 100);
    } else if (!successfullyRejoined) {
        showScreen('join');
    }

    fetch('metadata.json').then(res => res.json()).then(data => {
        if (data.version && versionElement) versionElement.textContent = `גרסה ${data.version}`;
    }).catch(err => console.error('Error fetching app version:', err));
});