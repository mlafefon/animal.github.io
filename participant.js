// This file will handle the logic for the participant's view.
// It will communicate with the host's tab via Appwrite Realtime.

import { initializeNotification, showNotification } from './js/ui.js';
import { getGameSession, subscribeToSessionUpdates, sendAction, unsubscribeAllRealtime } from './js/appwriteService.js';


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
let sessionDocumentId = null;


// --- Utility Functions ---

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
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

async function handleTeamSelection(teamIndex) {
    myTeam = currentHostState.teams.find(t => t.index === teamIndex);

    if (!myTeam || myTeam.isTaken) {
        teamSelectError.textContent = 'קבוצה זו נתפסה. אנא בחר קבוצה אחרת.';
        teamSelectError.classList.remove('hidden');
        return;
    }
    
    // Disable all buttons to prevent double-selection
    teamSelectionGrid.querySelectorAll('.team-member').forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.6';
    });


    try {
        await sendAction(gameCode, {
            type: 'selectTeam',
            teamIndex: teamIndex,
            participantId: participantId
        });
        
        // The host will receive this action and broadcast the new state.
        // The realtime listener will then handle moving to the next screen.
        teamSelectError.classList.add('hidden');
        myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
        myTeamIcon.src = myTeam.icon;
        
    } catch (error) {
         teamSelectError.textContent = 'שגיאה בבחירת קבוצה. נסה שוב.';
         teamSelectError.classList.remove('hidden');
         // Re-enable buttons on error
         initializeTeamSelectScreen(currentHostState);
    }
}

function updateGameView(state) {
    currentHostState = state; // Update global state

    // If I have selected a team, I should be on the game screen.
    if (myTeam) {
        // Find my team in the new state to check if I was the one who selected it.
        const myTeamInNewState = state.teams.find(t => t.index === myTeam.index);
        if (myTeamInNewState && myTeamInNewState.isTaken && screens.teamSelect.offsetParent !== null) {
             showScreen('game');
        }

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
    } else {
        // If I haven't selected a team, I should be on the team select screen.
        // Re-render it with the latest team taken status.
        renderTeamSelectScreen(state);
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
}


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
    initializeNotification();
    showScreen('join');
    initializeJoinScreen();
    initializeGameScreen();

    // Clean up subscriptions when the user closes the page
    window.addEventListener('beforeunload', () => {
        unsubscribeAllRealtime();
    });
});