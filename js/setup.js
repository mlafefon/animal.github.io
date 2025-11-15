import { getSavedState, initializeSetupState, getState, clearSessionDetails, unassignParticipant } from './gameState.js';
import { TEAMS_MASTER_DATA } from './game.js';
import { showNotification } from './ui.js';
import { createGameSession, getAccount, unsubscribeAllRealtime, updateGameSession } from './appwriteService.js';

// --- Elements from Setup Screen ---
const groupList = document.getElementById('group-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');
const setupGameTitle = document.getElementById('setup-game-title');
const joinedParticipantsContainer = document.getElementById('joined-participants-container');
const setupGameCodeDisplay = document.getElementById('setup-game-code-display');

// --- Elements from Join Host Screen ---
const joinHostScreen = document.getElementById('join-host-screen');
const startGameFromJoinBtn = document.getElementById('start-game-from-join-btn');
const joinHostCodeDisplay = document.getElementById('join-host-code-display');
const joinHostTeamsContainer = document.getElementById('join-host-teams-container');

// --- State ---
let selectedGameDocument = null;
let selectedGameData = null;
let _gameOptionsForStart = null;

// --- Functions for Join Host Screen ---

/**
 * Renders the empty team slots on the join screen.
 * @param {number} count The number of teams.
 */
function renderEmptyTeamSlots(count) {
    joinHostTeamsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const slot = document.createElement('div');
        slot.className = 'team-slot';
        slot.dataset.index = i;
        const teamMaster = TEAMS_MASTER_DATA[i % TEAMS_MASTER_DATA.length];
        slot.innerHTML = `
            <img src="${teamMaster.icon}" alt="${teamMaster.name}" style="display: none;">
            <button class="kick-participant-btn" title="הסר משתתף">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        `;
        joinHostTeamsContainer.appendChild(slot);
    }
}

/**
 * Updates the team slots UI on the join screen when a participant joins.
 * @param {Event} event The 'participantjoined' custom event.
 */
function updateTeamSlotsOnJoinScreen(event) {
    if (joinHostScreen.classList.contains('hidden')) return;
    const { teams } = event.detail;
    const slots = joinHostTeamsContainer.querySelectorAll('.team-slot');
    slots.forEach(slot => {
        const teamIndex = parseInt(slot.dataset.index, 10);
        const teamData = teams.find(t => t.index === teamIndex);
        if (teamData && teamData.isTaken && !slot.classList.contains('filled')) {
            const img = slot.querySelector('img');
            img.style.display = 'block';
            slot.classList.add('filled');
        }
    });
}

/**
 * Shows the join screen for the host.
 * @param {object} options Game options from the setup screen.
 */
function showJoinHostScreen(options) {
    _gameOptionsForStart = options;
    setupScreen.classList.add('hidden');
    joinHostCodeDisplay.textContent = options.gameCode;
    renderEmptyTeamSlots(options.numberOfGroups);
    joinHostScreen.classList.remove('hidden');
    startGameFromJoinBtn.focus();

    // Show the back button and hide the home button for this specific screen
    document.getElementById('back-to-setup-btn').classList.remove('hidden');
    document.getElementById('global-home-btn').classList.add('hidden');


    // --- Generate QR Code ---
    const qrContainer = document.getElementById('qrcode-container');
    if (qrContainer) {
        qrContainer.innerHTML = ''; // Clear previous QR code if any
        
        try {
            // Construct a URL relative to the current page's location.
            // This correctly handles subdirectories like /animal/.
            const url = new URL('participant.html', window.location.href);
            url.searchParams.set('code', options.gameCode);
            const participantUrl = url.href;

            new QRCode(qrContainer, {
                text: participantUrl,
                width: 320,
                height: 320,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        } catch (e) {
            console.warn("Failed to generate QR Code. Skipping generation.", e);
            // As per the request, we ignore the error and do not display anything.
        }
    }
}

// --- Functions for Setup Screen ---

/**
 * Updates the display of joined participant icons on the setup screen.
 * @param {Array<object>} teams - The array of team objects from the game state.
 */
export function updateSetupParticipantsDisplay(teams) {
    if (!joinedParticipantsContainer) return;
    joinedParticipantsContainer.innerHTML = '';
    const joinedTeams = teams.filter(t => t.isTaken);
    
    joinedTeams.forEach(team => {
        const img = document.createElement('img');
        img.src = team.icon;
        img.alt = team.name;
        img.title = team.name;
        img.className = 'participant-icon';
        joinedParticipantsContainer.appendChild(img);
    });
}

/**
 * Updates the UI with the number of questions in the bank and the calculated
 * number of questions that will actually be used in the game. It also enables/disables
 * the start button based on the number of actual questions.
 */
function updateQuestionStats() {
    const selectedGroupLi = groupList.querySelector('.selected');
    const questionBankStat = document.getElementById('question-bank-stat');
    const actualQuestionsStat = document.getElementById('actual-questions-stat');

    if (!selectedGroupLi || !questionBankStat || !actualQuestionsStat) {
        return;
    }
    
    if (!selectedGameData) {
        questionBankStat.textContent = 'בנק שאלות: --';
        actualQuestionsStat.textContent = 'שאלות בפועל: --';
        startButton.disabled = true;
        startButton.title = 'יש לבחור משחק';
        return;
    };

    const questionBankCount = selectedGameData.questions.length;
    const numberOfGroups = parseInt(selectedGroupLi.textContent, 10);

    const actualQuestionsCount = Math.floor(questionBankCount / numberOfGroups) * numberOfGroups;

    questionBankStat.textContent = `בנק שאלות: ${questionBankCount}`;
    actualQuestionsStat.textContent = `שאלות בפועל: ${actualQuestionsCount}`;

    const canContinue = document.getElementById('continue-last-point').checked;
    
    if (actualQuestionsCount === 0 && !canContinue) {
        startButton.disabled = true;
        startButton.title = 'לא ניתן להתחיל משחק ללא שאלות. יש לבחור פחות קבוצות.';
    } else {
        startButton.disabled = false;
        startButton.title = '';
    }
}


/**
 * Handles clicks on selection lists (like groups or games) to apply the 'selected' class.
 * @param {HTMLElement} list - The UL element.
 * @param {Event} event - The click event.
 */
function handleSelection(list, event) {
    if (event.target.tagName === 'LI') {
        [...list.children].forEach(li => li.classList.remove('selected'));
        event.target.classList.add('selected');
    }
}


/**
 * Toggles the enabled/disabled state of the main setup controls.
 * @param {boolean} disabled - True to disable, false to enable.
 */
function toggleSetupControls(disabled) {
    groupList.style.pointerEvents = disabled ? 'none' : 'auto';
    groupList.style.opacity = disabled ? 0.6 : 1;
    document.getElementById('shuffle-questions').disabled = disabled;
}

/**
 * Checks for a saved game state and updates the "Continue" checkbox accordingly.
 * This should be called each time the setup screen is shown.
 */
export async function refreshSetupScreenState() {
    const continueCheckbox = document.getElementById('continue-last-point');
    const continueLabel = document.querySelector('label[for="continue-last-point"]');
    const savedState = getSavedState(); // Use new centralized function

    if (savedState && savedState.gameName) {
        continueCheckbox.disabled = false;
        continueLabel.textContent = `המשך "${savedState.gameName}"`;
    } else {
        continueCheckbox.disabled = true;
        continueLabel.textContent = 'המשך מנקודה אחרונה';
        if (savedState) { // If state exists but is corrupt/missing name
            localStorage.removeItem('animalGameState'); // Clean it up
        }
    }
    
    continueCheckbox.checked = false;
    toggleSetupControls(false);
}

/**
 * Shows the setup screen for a specific game chosen from the previous screen.
 * @param {object} gameDoc The full game document from Appwrite.
 */
export async function showSetupScreenForGame(gameDoc) {
    selectedGameDocument = gameDoc;
    try {
        selectedGameData = JSON.parse(gameDoc.game_data);
    } catch (e) {
        alert('שגיאה בנתוני המשחק שנבחר.');
        console.error("Could not parse game data in setup:", e);
        return;
    }

    if (setupGameTitle) {
        setupGameTitle.textContent = selectedGameDocument.game_name;
    }

    if (joinedParticipantsContainer) {
        joinedParticipantsContainer.innerHTML = ''; // Clear on new game setup
    }

    const gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    if (setupGameCodeDisplay) {
        setupGameCodeDisplay.textContent = gameCode;
    }
    
    refreshSetupScreenState();
    setupScreen.classList.remove('hidden');
    updateQuestionStats();
}

/**
 * Handles the host's action to kick a participant from a team.
 * @param {number} teamIndex The index of the team to free up.
 */
function handleKickParticipant(teamIndex) {
    unassignParticipant(teamIndex);

    // Update the UI on the host's join screen immediately.
    const slot = joinHostTeamsContainer.querySelector(`.team-slot[data-index="${teamIndex}"]`);
    if (slot) {
        slot.classList.remove('filled');
        const img = slot.querySelector('img');
        if (img) img.style.display = 'none';
    }

    // Trigger a state change event to broadcast to all participants.
    document.dispatchEvent(new Event('gamestatechange'));

    showNotification(`המשתתף מקבוצה ${teamIndex + 1} הוסר.`, 'info');
}


/**
 * Initializes the setup screen by attaching event listeners.
 * @param {function} onStart - The callback function to execute when the start button is clicked.
 */
export function initializeSetupScreen(onStart) {
    groupList.querySelectorAll('li').forEach(li => {
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
    });

    const continueCheckbox = document.getElementById('continue-last-point');
    
    continueCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        toggleSetupControls(isChecked);
        updateQuestionStats();
    });

    groupList.addEventListener('click', (e) => {
        handleSelection(groupList, e);
        updateQuestionStats();
    });

    if(setupGameCodeDisplay) {
        setupGameCodeDisplay.addEventListener('click', () => {
            navigator.clipboard.writeText(setupGameCodeDisplay.textContent).then(() => {
                showNotification('הקוד הועתק!', 'success');
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                showNotification('שגיאה בהעתקת הקוד', 'error');
            });
        });
    }

    // Listen for participant joins to update BOTH screens if needed
    document.addEventListener('participantjoined', (e) => {
        updateSetupParticipantsDisplay(e.detail.teams);
        updateTeamSlotsOnJoinScreen(e);
    });

    // Start Button from Setup Screen
    startButton.addEventListener('click', async () => {
        const actualQuestionsText = document.getElementById('actual-questions-stat').textContent;
        const actualQuestions = parseInt(actualQuestionsText.split(':')[1].trim(), 10) || 0;
        const continueLastPoint = document.getElementById('continue-last-point').checked;

        if (actualQuestions === 0 && !continueLastPoint) {
            alert('לא ניתן להתחיל את המשחק כי מספר השאלות בפועל הוא אפס. אנא בחר מספר קבוצות קטן יותר.');
            return;
        }

        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const options = { 
            numberOfGroups, 
            documentId: selectedGameDocument ? selectedGameDocument.$id : null, 
            gameDataString: selectedGameDocument ? selectedGameDocument.game_data : '{}', 
            shuffleQuestions: document.getElementById('shuffle-questions').checked, 
            actualQuestions, 
            continueLastPoint, 
            gameName: selectedGameDocument ? selectedGameDocument.game_name : ''
        };

        if (continueLastPoint) {
            setupScreen.classList.add('hidden');
            onStart(options);
            return;
        }

        if (!selectedGameDocument) {
            alert('יש לבחור משחק.');
            return;
        }
        
        // --- MODIFIED GAME FLOW ---
        const currentState = getState();
        const existingSessionId = currentState.sessionDocumentId;
        const existingGameCode = currentState.gameCode;

        // Check if we can reuse the existing session.
        if (existingSessionId && existingGameCode) {
            options.gameCode = existingGameCode;
            options.sessionDocumentId = existingSessionId;
            const teamsForSession = TEAMS_MASTER_DATA.slice(0, options.numberOfGroups).map((t, i) => ({ index: i, name: t.name, iconKey: t.iconKey, isTaken: false, participantId: null }));
            initializeSetupState(options.gameName, options.gameCode, options.sessionDocumentId, teamsForSession);
            
            // Reset the session document in Appwrite with a fresh (empty) team list.
            const sessionData = { gameCode: options.gameCode, gameName: options.gameName, teams: teamsForSession, gameState: 'setup' };
            try {
                await updateGameSession(options.sessionDocumentId, sessionData);
                document.dispatchEvent(new CustomEvent('setupready', { detail: { gameCode: options.gameCode } }));
                showJoinHostScreen(options);
            } catch (error) {
                 console.error("Failed to reset reused game session:", error);
                 showNotification("שגיאה באיפוס סשן המשחק. יוצר סשן חדש.", "error");
                 clearSessionDetails();
                 startButton.click(); // Re-trigger click to try creating a new session.
            }
        } else {
            // No session to reuse, create a new one.
            const gameCode = Math.floor(100000 + Math.random() * 900000).toString();
            options.gameCode = gameCode;

            try {
                const user = await getAccount();
                const teamsForSession = TEAMS_MASTER_DATA.slice(0, options.numberOfGroups).map((t, i) => ({ index: i, name: t.name, iconKey: t.iconKey, isTaken: false, participantId: null }));
                
                const sessionData = { gameCode, gameName: options.gameName, teams: teamsForSession, gameState: 'setup' };
                const sessionDoc = await createGameSession(gameCode, user.$id, sessionData);
                
                initializeSetupState(options.gameName, gameCode, sessionDoc.$id, teamsForSession);
                options.sessionDocumentId = sessionDoc.$id;
                
                document.dispatchEvent(new CustomEvent('setupready', { detail: { gameCode } }));
                showJoinHostScreen(options);
            } catch (error) {
                console.error("Failed to create game session:", error);
                showNotification("שגיאה ביצירת סשן המשחק.", "error");
            }
        }
    });

    // Back button from Join Screen
    const backToSetupBtn = document.getElementById('back-to-setup-btn');
    if (backToSetupBtn) {
        backToSetupBtn.addEventListener('click', () => {
            unsubscribeAllRealtime();
            
            const currentState = getState();
            const hasParticipants = currentState.teams.some(team => team.isTaken);

            if (hasParticipants) {
                clearSessionDetails();
                showNotification('נוצר קוד משחק חדש מכיוון שמשתתפים הצטרפו לסשן הקודם.', 'info');
            }

            joinHostScreen.classList.add('hidden');
            setupScreen.classList.remove('hidden');
            
            backToSetupBtn.classList.add('hidden');
            document.getElementById('global-home-btn').classList.remove('hidden');

            startButton.focus();
        });
    }

    // Start Button from Join Screen
    startGameFromJoinBtn.addEventListener('click', () => {
        joinHostScreen.classList.add('hidden');
        
        document.getElementById('back-to-setup-btn').classList.add('hidden');
        document.getElementById('global-home-btn').classList.remove('hidden');

        if (onStart && _gameOptionsForStart) {
            onStart(_gameOptionsForStart);
        }
    });

    // Code copy from Join screen
    joinHostCodeDisplay.addEventListener('click', () => {
        navigator.clipboard.writeText(joinHostCodeDisplay.textContent).then(() => {
            showNotification('הקוד הועתק!', 'success');
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            showNotification('שגיאה בהעתקת הקוד', 'error');
        });
    });

    // Listener for kicking participants from the Join Host screen
    joinHostTeamsContainer.addEventListener('click', (e) => {
        const kickBtn = e.target.closest('.kick-participant-btn');
        if (kickBtn) {
            const slot = kickBtn.closest('.team-slot');
            if (slot) {
                const teamIndex = parseInt(slot.dataset.index, 10);
                handleKickParticipant(teamIndex);
            }
        }
    });
}