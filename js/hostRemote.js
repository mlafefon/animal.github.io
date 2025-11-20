


import { getGameSession, getAccount, subscribeToSessionUpdates, sendAction, unsubscribeAllRealtime } from './appwriteService.js';
import { showNotification } from './ui.js';

const remoteScreen = document.getElementById('host-remote-screen');
const remoteLogin = document.getElementById('host-remote-login');
const remotePanel = document.getElementById('host-remote-panel');
const codeInput = document.getElementById('remote-code-input');
const connectBtn = document.getElementById('connect-remote-btn');
const errorMsg = document.getElementById('remote-error');
const closeBtn = document.getElementById('close-remote-btn');
const controlsContainer = document.getElementById('remote-controls-container');
const gameCodeDisplay = document.getElementById('remote-game-code-display');
const statusDisplay = document.getElementById('remote-status');

let currentGameCode = null;
let hostId = null;
let isPassingMode = false; // New local state
let latestState = null; // Cache state for re-rendering

export function initializeHostRemote(onClose) {
    if (!remoteScreen) return;

    connectBtn.addEventListener('click', handleConnect);
    closeBtn.addEventListener('click', () => {
        unsubscribeAllRealtime();
        if (onClose) onClose();
    });
}

export function showHostRemoteLogin() {
    remoteScreen.classList.remove('hidden');
    remoteLogin.classList.remove('hidden');
    remotePanel.classList.add('hidden');
    codeInput.value = '';
    errorMsg.classList.add('hidden');
    codeInput.focus();
}

async function handleConnect() {
    const code = codeInput.value.trim();
    if (!code || code.length !== 6) {
        showError('יש להזין קוד משחק תקין בן 6 ספרות.');
        return;
    }

    try {
        const user = await getAccount();
        if (!user) {
            showError('עליך להיות מחובר כדי להשתמש בשלט.');
            return;
        }
        hostId = user.$id;

        const sessionDoc = await getGameSession(code);
        if (!sessionDoc) {
            showError('לא נמצא משחק פעיל עם קוד זה.');
            return;
        }

        if (sessionDoc.hostId !== hostId) {
            showError('אינך המנחה של משחק זה.');
            return;
        }

        // Verification successful
        currentGameCode = code;
        enterRemoteMode(sessionDoc);

    } catch (error) {
        console.error(error);
        showError('שגיאה בהתחברות למשחק.');
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function enterRemoteMode(initialSessionDoc) {
    remoteLogin.classList.add('hidden');
    remotePanel.classList.remove('hidden');
    gameCodeDisplay.textContent = `משחק: ${currentGameCode}`;

    // Subscribe to updates
    subscribeToSessionUpdates(initialSessionDoc.$id, (response) => {
        const state = JSON.parse(response.payload.sessionData);
        updateRemoteUI(state);
    });

    // Initial UI Update
    const initialState = JSON.parse(initialSessionDoc.sessionData);
    updateRemoteUI(initialState);
}

function updateRemoteUI(state) {
    latestState = state;
    controlsContainer.innerHTML = '';
    const activeTeam = state.teams.find(t => t.index === state.activeTeamIndex);
    const activeTeamName = activeTeam ? activeTeam.name : 'לא ידוע';

    statusDisplay.textContent = `תור: ${activeTeamName} | מצב: ${getHebrewState(state.gameState)}`;

    // Safety reset: If state is not incorrectAnswer, we shouldn't be in passing mode
    if (state.gameState !== 'incorrectAnswer') {
        isPassingMode = false;
    }

    // --- Passing Mode View ---
    if (isPassingMode) {
        const p = document.createElement('p');
        p.style.color = 'white';
        p.style.textAlign = 'center';
        p.style.fontSize = '1.2rem';
        p.style.marginBottom = '1rem';
        p.textContent = 'בחר קבוצה להעביר אליה את השאלה:';
        controlsContainer.appendChild(p);

        const grid = document.createElement('div');
        grid.className = 'remote-chests-grid'; // Reuse grid style
        
        state.teams.forEach(team => {
            if (team.index !== state.activeTeamIndex) {
                const btn = document.createElement('button');
                btn.className = 'remote-chest-btn';
                btn.style.fontSize = '1.2rem'; // Adjust font for names
                btn.textContent = team.name;
                btn.onclick = () => {
                    isPassingMode = false; // Exit mode locally
                    sendRemoteAction('remote_pass_to', { teamIndex: team.index });
                };
                grid.appendChild(btn);
            }
        });
        controlsContainer.appendChild(grid);

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'remote-btn remote-btn-incorrect'; // Red style
        cancelBtn.style.marginTop = '1.5rem';
        cancelBtn.textContent = 'ביטול';
        cancelBtn.onclick = () => {
            isPassingMode = false;
            updateRemoteUI(latestState);
        };
        controlsContainer.appendChild(cancelBtn);
        return; // Stop standard rendering
    }

    // --- Standard Views ---
    // Render controls based on state
    switch (state.gameState) {
        case 'question':
            renderButton('עצור טיימר', 'remote-btn-stop', 'remote_stop');
            break;
        
        case 'grading':
            renderButton('תשובה נכונה', 'remote-btn-correct', 'remote_correct');
            renderButton('תשובה שגויה', 'remote-btn-incorrect', 'remote_incorrect');
            break;

        case 'correctAnswer':
             // When answer is correct, Desktop shows Victory Box button.
             renderButton('תיבת ניצחון', 'remote-btn-primary', 'remote_next');
             break;

        case 'incorrectAnswer':
            renderButton('תיבת כשלון', 'remote-btn-incorrect', 'remote_next');
            // Instead of sending action immediately, switch local mode
            const passBtn = document.createElement('button');
            passBtn.className = 'remote-btn remote-btn-pass';
            passBtn.textContent = 'העבר שאלה';
            passBtn.onclick = () => {
                isPassingMode = true;
                updateRemoteUI(latestState);
            };
            controlsContainer.appendChild(passBtn);
            break;

        case 'learningTime':
             renderButton('המשך לתיבה', 'remote-btn-primary', 'remote_next');
             break;
        
        case 'boxes-revealed':
            renderButton('חזרה', 'remote-btn-primary', 'remote_next');
            break;
        
        case 'boxes':
            // Render chest selection grid
            const grid = document.createElement('div');
            grid.className = 'remote-chests-grid';
            for(let i=0; i<3; i++) {
                const btn = document.createElement('button');
                btn.className = 'remote-chest-btn';
                btn.textContent = i + 1;
                btn.onclick = () => sendRemoteAction('remote_select_chest', { chestIndex: i });
                grid.appendChild(btn);
            }
            controlsContainer.appendChild(grid);
            const p = document.createElement('p');
            p.style.color = 'white';
            p.style.textAlign = 'center';
            p.textContent = 'בחר תיבה עבור הקבוצה';
            controlsContainer.appendChild(p);
            break;
        
        case 'finalRoundPre':
            renderButton('שאלת ההימור', 'remote-btn-primary', 'remote_next');
            break;
            
        default:
            renderButton('השאלה הבאה / התחל', 'remote-btn-primary', 'remote_next');
            break;
    }
}

function renderButton(text, cssClass, actionType) {
    const btn = document.createElement('button');
    btn.className = `remote-btn ${cssClass}`;
    btn.textContent = text;
    btn.onclick = () => sendRemoteAction(actionType);
    controlsContainer.appendChild(btn);
}

function getHebrewState(state) {
    const map = {
        'waiting': 'ממתין',
        'question': 'שאלה רצה',
        'grading': 'בדיקה',
        'correctAnswer': 'תשובה נכונה',
        'incorrectAnswer': 'תשובה שגויה',
        'learningTime': 'זמן למידה',
        'boxes': 'בחירת תיבה',
        'boxes-revealed': 'תיבה נחשפה',
        'finalRoundPre': 'הסיבוב האחרון'
    };
    return map[state] || state;
}

async function sendRemoteAction(type, extraData = {}) {
    try {
        await sendAction(currentGameCode, {
            type: type,
            ...extraData
        });
    } catch (e) {
        showNotification('שגיאה בשליחת פקודה', 'error');
    }
}