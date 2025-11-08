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
    boxes: document.getElementById('participant-boxes-screen')
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

    // Create the full `myTeam` object for local use, rehydrating the icon URL
    myTeam = {
        ...selectedTeamData,
        icon: IMAGE_URLS[selectedTeamData.iconKey]
    };
    
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
         renderTeamSelectScreen(currentHostState);
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


function updateGameView(state) {
    currentHostState = state; // Update global state

    // If the game is over, reset the view to the join screen
    if (state.gameState === 'finished') {
        unsubscribeAllRealtime();
        showNotification('המשחק הסתיים. תודה שהשתתפתם!', 'success');
        setTimeout(() => window.location.reload(), 3000);
        return;
    }

    // Handle box selection state
    if (state.gameState === 'boxes' || state.gameState === 'boxes-revealed') {
        const isMyTurnForBoxes = myTeam && state.activeTeamIndex === myTeam.index;
        
        if (isMyTurnForBoxes) {
            showScreen('boxes');
            renderBoxesScreen(state);
        } else {
            showScreen('game'); // Other teams see a waiting message
            const activeTeam = state.teams.find(t => t.index === state.activeTeamIndex);
            const activeTeamName = activeTeam ? activeTeam.name : 'הקבוצה';
            questionText.textContent = `ממתין לקבוצת ${activeTeamName} לבחור תיבה...`;
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
        }
        return; // End processing for this state
    }


    // If I have selected a team, I should be on the game screen.
    if (myTeam) {
        // Find my team in the new state to check if I was the one who selected it.
        const myTeamInNewState = state.teams.find(t => t.index === myTeam.index);
        if (myTeamInNewState && myTeamInNewState.isTaken && screens.teamSelect.offsetParent !== null) {
             showScreen('game');
        }

        const isMyTurn = (state.activeTeamIndex === myTeam.index);
        const isQuestionActive = (state.gameState === 'question' && state.currentQuestion);

        stopBtn.disabled = false; // Re-enable stop button for new question

        if (isQuestionActive) {
            questionText.textContent = state.currentQuestion.q;
            
            if(isMyTurn) {
                participantControls.classList.remove('hidden');
                waitingMessage.classList.add('hidden');
            } else {
                participantControls.classList.add('hidden');
                waitingMessage.classList.remove('hidden');
            }
        } else if (state.gameState === 'grading') {
             if (isMyTurn) {
                questionText.textContent = 'ממתין לניקוד מהמנחה...';
            } else {
                const activeTeam = state.teams.find(t => t.index === state.activeTeamIndex);
                const activeTeamName = activeTeam ? activeTeam.name : 'הקבוצה';
                questionText.textContent = `ממתין לניקוד של קבוצת ${activeTeamName}...`;
            }
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
        }
        else { // This block is now primarily for the 'waiting' state
            const activeTeam = state.teams.find(t => t.index === state.activeTeamIndex);
            const activeTeamName = activeTeam ? activeTeam.name : 'הקבוצה';
            if (isMyTurn) {
                 questionText.textContent = 'הקבוצה ממתינה לתורה';
            } else {
                 questionText.textContent = `ממתינים לתור של קבוצת ${activeTeamName}...`;
            }
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