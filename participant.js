// This file will handle the logic for the participant's view.
// It will communicate with the host's tab via localStorage.

import { initializeNotification, showNotification } from './js/ui.js';

// --- DOM Elements ---
const screens = {
    join: document.getElementById('join-screen'),
    teamSelect: document.getElementById('team-select-screen'),
    game: document.getElementById('participant-game-screen')
};
const joinForm = document.getElementById('join-form');
const gameCodeInput = document.getElementById('game-code-input');
const joinError = document.getElementById('join-error');
const teamSelectionGrid = document.getElementById('team-selection-grid');
const teamSelectGameName = document.getElementById('team-select-game-name');
const teamSelectError = document.getElementById('team-select-error');
const myTeamIcon = document.getElementById('my-team-icon');
const myTeamName = document.getElementById('my-team-name');
const questionText = document.getElementById('participant-question-text');
const participantControls = document.getElementById('participant-controls');
const stopBtn = document.getElementById('participant-stop-btn');
const waitingMessage = document.getElementById('waiting-message');


// --- State ---
let participantId = `participant_${Math.random().toString(36).substr(2, 9)}`;
let myTeam = null;
let gameCode = null;
let currentHostState = null;


// --- Utility Functions ---

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
}

function getSessionKey() {
    return `animalGameSession_${gameCode}`;
}

function getActionKey() {
    return `animalGameParticipantAction_${gameCode}`;
}

// --- Screen Initialization ---

function initializeJoinScreen() {
    joinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        gameCode = gameCodeInput.value;
        if (!gameCode || gameCode.length !== 6) {
            joinError.textContent = 'יש להזין קוד משחק בן 6 ספרות.';
            joinError.classList.remove('hidden');
            return;
        }

        const sessionData = localStorage.getItem(getSessionKey());
        if (!sessionData) {
            joinError.textContent = 'קוד המשחק שהוזן אינו תקין או שהמשחק לא התחיל.';
            joinError.classList.remove('hidden');
            return;
        }

        joinError.classList.add('hidden');
        currentHostState = JSON.parse(sessionData);
        initializeTeamSelectScreen();
        showScreen('teamSelect');
    });
}

function initializeTeamSelectScreen() {
    teamSelectGameName.textContent = currentHostState.gameName;
    teamSelectionGrid.innerHTML = '';

    currentHostState.teams.forEach(team => {
        const teamElement = document.createElement('div');
        teamElement.className = 'team-member';
        teamElement.dataset.index = team.index;
        teamElement.innerHTML = `
            <div class="team-icon">
                <img src="${team.icon}" alt="${team.name}">
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

function handleTeamSelection(teamIndex) {
    // Re-fetch state right before selection to prevent race conditions
    const latestState = JSON.parse(localStorage.getItem(getSessionKey()));
    if (!latestState) return;
    currentHostState = latestState;
    
    myTeam = currentHostState.teams.find(t => t.index === teamIndex);

    if (!myTeam || myTeam.isTaken) {
        teamSelectError.textContent = 'קבוצה זו נתפסה. אנא בחר קבוצה אחרת.';
        teamSelectError.classList.remove('hidden');
        // Refresh the view in case another player took the spot
        initializeTeamSelectScreen();
        return;
    }

    // Notify the host (and other participants) about the selection
    localStorage.setItem(getActionKey(), JSON.stringify({
        action: 'selectTeam',
        teamIndex: teamIndex,
        participantId: participantId,
        timestamp: Date.now()
    }));
    
    teamSelectError.classList.add('hidden');
    myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
    myTeamIcon.src = myTeam.icon;
    
    initializeGameScreen();
    showScreen('game');
}


function initializeGameScreen() {
    updateGameView(currentHostState);
    
    // Listen for state changes from the host
    window.addEventListener('storage', (event) => {
        if (event.key === getSessionKey() && event.newValue) {
            const newState = JSON.parse(event.newValue);
            if (newState) {
                currentHostState = newState;
                updateGameView(newState);
            }
        }
    });

    stopBtn.addEventListener('click', () => {
        // Notify the host that the timer should be stopped
        localStorage.setItem(getActionKey(), JSON.stringify({
            action: 'stopTimer',
            teamIndex: myTeam.index,
            participantId: participantId,
            timestamp: Date.now()
        }));
        // Hide button immediately to prevent multiple clicks
        participantControls.classList.add('hidden');
    });
}

function updateGameView(state) {
    if (!myTeam) return;

    const isMyTurn = (state.activeTeamIndex === myTeam.index);
    const isQuestionActive = (state.gameState === 'question' && state.currentQuestion);

    if (isQuestionActive) {
        questionText.textContent = state.currentQuestion.q;
        
        if(isMyTurn) {
            participantControls.classList.remove('hidden');
            waitingMessage.classList.add('hidden');
        } else {
            participantControls.classList.add('hidden');
            waitingMessage.classList.remove('hidden');
        }
    } else {
        questionText.textContent = 'ממתין לשאלה מהמנחה...';
        participantControls.classList.add('hidden');
        waitingMessage.classList.add('hidden');
    }
}


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
    initializeNotification();
    showScreen('join');
    initializeJoinScreen();
});
