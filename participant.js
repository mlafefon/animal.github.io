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
let pendingTeamIndex = null; // Track the team selection attempt


// --- Utility Functions ---

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
}

/**
 * Clears the visual "pending" state from the team selection grid.
 */
function clearPendingState() {
    pendingTeamIndex = null;
    teamSelectionGrid.querySelectorAll('.team-member').forEach(el => {
        el.classList.remove('pending', 'loading');
    });
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

/**
 * Handles the pessimistic team selection process. It shows a pending state
 * and sends an action to the host, waiting for a broadcast to confirm.
 * @param {number} teamIndex The index of the team the participant is trying to select.
 */
async function handleTeamSelection(teamIndex) {
    if (pendingTeamIndex !== null) return; // Already waiting for a response

    const selectedTeamData = currentHostState.teams.find(t => t.index === teamIndex);

    if (!selectedTeamData || selectedTeamData.isTaken) {
        teamSelectError.textContent = 'קבוצה זו נתפסה. אנא בחר קבוצה אחרת.';
        teamSelectError.classList.remove('hidden');
        return;
    }
    
    pendingTeamIndex = teamIndex;
    teamSelectError.classList.add('hidden');

    // Visually mark the choice as pending and disable other options
    teamSelectionGrid.querySelectorAll('.team-member').forEach(el => {
        if (parseInt(el.dataset.index, 10) === teamIndex) {
            el.classList.add('pending');
        } else {
            el.classList.add('loading');
        }
    });

    try {
        await sendAction(gameCode, {
            type: 'selectTeam',
            teamIndex: teamIndex,
            participantId: participantId
        });
        // Now we just wait for the broadcast. The updateGameView function will handle the result.
    } catch (error) {
        showNotification('שגיאה בבחירת קבוצה. נסה שוב.', 'error');
        clearPendingState(); // Revert UI on network error
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
    
    // This block handles the critical logic for resolving a pending team selection.
    if (pendingTeamIndex !== null) {
        const myAttemptedTeam = state.teams.find(t => t.index === pendingTeamIndex);

        if (myAttemptedTeam && myAttemptedTeam.participantId === participantId) {
            // SUCCESS! My selection was confirmed by the host.
            myTeam = { ...myAttemptedTeam, icon: IMAGE_URLS[myAttemptedTeam.iconKey] };
            
            myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
            myTeamIcon.src = myTeam.icon;
            
            teamSelectError.classList.add('hidden'); // Hide any previous errors
            clearPendingState();

            showScreen('game');
            questionText.textContent = `הצטרפת לקבוצת ${myTeam.name}! ממתין למנחה שיתחיל את המשחק...`;
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
            return; // Exit, as the view is now correctly set.

        } else if (myAttemptedTeam && myAttemptedTeam.isTaken) {
            // FAILURE! Someone else claimed the team first.
            teamSelectError.textContent = 'הקבוצה שבחרת נתפסה. אנא בחר קבוצה אחרת.';
            teamSelectError.classList.remove('hidden');
            
            // Clear pending state and immediately re-render to reflect the taken team.
            clearPendingState();
            renderTeamSelectScreen(state);
            return; // Exit, the selection screen has been updated.
        } else {
            // UNEXPECTED STATE: The update didn't resolve the pending request.
            // This is a safety net to prevent a stuck UI. Clear the pending state
            // and fall through to re-render with the latest data.
            console.warn('Received an update while pending, but it did not resolve the selection. Resetting.');
            clearPendingState();
        }
    }


    // If the game is over, reset the view to the join screen
    if (state.gameState === 'finished') {
        unsubscribeAllRealtime();
        showNotification('המשחק הסתיים. תודה שהשתתפתם!', 'success');
        setTimeout(() => window.location.reload(), 3000);
        return;
    }

    // This logic runs if the participant has NOT yet chosen a team.
    if (!myTeam) {
        renderTeamSelectScreen(state);
        showScreen('teamSelect');
        return;
    }
    
    // This logic runs AFTER the participant has a confirmed team.
    
    const isMyTurn = state.activeTeamIndex == myTeam.index;
    const activeTeam = state.teams.find(t => t.index === state.activeTeamIndex);
    const activeTeamName = activeTeam ? activeTeam.name : 'הקבוצה';

    participantControls.classList.add('hidden');
    waitingMessage.classList.add('hidden');

    switch (state.gameState) {
        case 'question':
            showScreen('game');
            questionText.textContent = state.currentQuestion.q;
            if (isMyTurn) {
                participantControls.classList.remove('hidden');
                stopBtn.disabled = false;
            } else {
                waitingMessage.querySelector('p').textContent = `התור של קבוצת ${activeTeamName}.`;
                waitingMessage.classList.remove('hidden');
            }
            break;

        case 'grading':
            showScreen('game');
            questionText.textContent = isMyTurn
                ? 'התשובה התקבלה. ממתין לניקוד מהמנחה...'
                : `המנחה בודק את התשובה של קבוצת ${activeTeamName}...`;
            break;
            
        case 'boxes':
        case 'boxes-revealed':
            if (isMyTurn) {
                showScreen('boxes');
                renderBoxesScreen(state);
            } else {
                showScreen('game');
                questionText.textContent = `ממתין לקבוצת ${activeTeamName} לבחור תיבת אוצר...`;
            }
            break;
        
        case 'setup':
            showScreen('game');
            questionText.textContent = "המשחק יתחיל בקרוב...";
            break;

        case 'waiting':
        default:
            showScreen('game');
            questionText.textContent = isMyTurn 
                ? 'מוכנים? השאלה הבאה אליכם'
                : `התור הבא הוא של קבוצת ${activeTeamName}. השאלה תופיע בקרוב...`;
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
            
            gameCode = code;
            sessionDocumentId = sessionDoc.$id;
            const sessionData = JSON.parse(sessionDoc.sessionData);
            
            joinError.classList.add('hidden');
            
            subscribeToSessionUpdates(sessionDocumentId, (response) => {
                const updatedData = JSON.parse(response.payload.sessionData);
                updateGameView(updatedData);
            });
            
            updateGameView(sessionData);

        } catch (error) {
            console.error("Failed to join game:", error);
            joinError.textContent = 'אירעה שגיאה. בדוק את חיבור האינטרנט ונסה שוב.';
            joinError.classList.remove('hidden');
        }
    });
}

function initializeGameScreen() {
    stopBtn.addEventListener('click', async () => {
        stopBtn.disabled = true; 
        try {
            await sendAction(gameCode, {
                type: 'stopTimer',
                teamIndex: myTeam.index,
                participantId: participantId
            });
        } catch (error) {
            showNotification('שגיאה בשליחת הפעולה.', 'error');
            stopBtn.disabled = false;
        }
    });
}


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
    initializeNotification();
    showScreen('join');
    initializeJoinScreen();
    initializeGameScreen();

    window.addEventListener('beforeunload', () => {
        unsubscribeAllRealtime();
    });

    fetch('metadata.json')
        .then(response => response.json())
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
