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
const participantId = `participant_${Math.random().toString(36).substr(2, 9)}`;
let myTeam = null; // Will be set only after the host CONFIRMS the selection.
let selectionAttempt = null; // Stores the team we are currently trying to select.
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
    // Final client-side check before sending action
    if (currentHostState.teams.find(t => t.index === teamIndex)?.isTaken) {
        showNotification('קבוצה זו נתפסה זה עתה.', 'error');
        return;
    }

    // --- Enter Pending State ---
    teamSelectError.classList.add('hidden');
    teamSelectionGrid.querySelectorAll('.team-member').forEach(el => {
        // Disable all teams to prevent further clicks during verification
        el.classList.add('taken'); 
        if (parseInt(el.dataset.index, 10) === teamIndex) {
            // Add a visual indicator to the one being attempted
            el.classList.add('pending');
        }
    });
    
    // Store the attempted selection. This is crucial for the update logic.
    const selectedTeamData = currentHostState.teams.find(t => t.index === teamIndex);
    selectionAttempt = {
        ...selectedTeamData,
        icon: IMAGE_URLS[selectedTeamData.iconKey]
    };

    // Send the selection action to the host for verification
    try {
        await sendAction(gameCode, {
            type: 'selectTeam',
            teamIndex: teamIndex,
            participantId: participantId
        });
        // Now we wait for the realtime update from the host. 
        // `updateGameView` will handle success or failure.
    } catch (error) {
        showNotification('שגיאה בבחירת קבוצה. נסה שוב.', 'error');
        selectionAttempt = null; 
        renderTeamSelectScreen(currentHostState); // Revert UI on error
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
    currentHostState = state; // Always keep the latest state

    if (state.gameState === 'finished') {
        unsubscribeAllRealtime();
        showNotification('המשחק הסתיים. תודה שהשתתפתם!', 'success');
        setTimeout(() => window.location.reload(), 3000);
        return;
    }

    // --- SETUP PHASE LOGIC ---
    // This block handles the entire team selection flow, including race conditions.
    if (state.gameState === 'setup') {
        // If I am currently trying to select a team
        if (selectionAttempt) {
            const myAttemptedTeam = state.teams.find(t => t.index === selectionAttempt.index);
            // Check for SUCCESS: The team is now taken AND it's taken by me.
            if (myAttemptedTeam && myAttemptedTeam.participantId === participantId) {
                myTeam = selectionAttempt; // Confirm my team choice
                selectionAttempt = null;    // Clear the attempt state

                // Update UI for the game screen
                myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
                myTeamIcon.src = myTeam.icon;
                
                // Transition to the game screen (waiting state)
                showScreen('game');
                questionText.textContent = `הצטרפת לקבוצת ${myTeam.name}! ממתין למנחה שיתחיל את המשחק...`;
            } else {
                // FAILURE: The team was taken by someone else (or another state change occurred).
                showNotification('הקבוצה שבחרת נתפסה. אנא בחר קבוצה אחרת.', 'info');
                selectionAttempt = null; // Clear the attempt state
                renderTeamSelectScreen(state); // Re-render the selection screen with the latest data
                showScreen('teamSelect');
            }
        } else {
            // If I'm not attempting a selection, just display the latest team availability.
            renderTeamSelectScreen(state);
            showScreen('teamSelect');
        }
        return; // IMPORTANT: Stop execution here for the setup phase.
    }

    // --- GAMEPLAY PHASE LOGIC ---
    // At this point, `myTeam` is confirmed and the game has started.
    
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
            
            // Subscribe to updates for this session
            subscribeToSessionUpdates(sessionDocumentId, (response) => {
                const updatedData = JSON.parse(response.payload.sessionData);
                updateGameView(updatedData);
            });
            
            // Initial render and switch to team select screen
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
        .then(response => response.ok ? response.json() : Promise.reject('Failed to load metadata'))
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
