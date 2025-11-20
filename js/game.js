







import { showPreQuestionScreen } from './preq.js';
import { playSound, stopSound } from './audio.js';
import { IMAGE_URLS } from './assets.js';
import * as gameState from './gameState.js';
import { subscribeToActions, updateGameSession, unsubscribeAllRealtime } from './appwriteService.js';
import { triggerManualGrading, stopTimer } from './question.js';
import { revealChest } from './boxes.js';
import { showNotification } from './ui.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const mainTeamsContainer = document.getElementById('main-teams-container');
const mainGameFooter = document.getElementById('main-game-footer');
const setupScreen = document.getElementById('setup-screen');
const showJoinInfoBtn = document.getElementById('show-join-info-btn');
const inGameJoinModalOverlay = document.getElementById('in-game-join-modal-overlay');

// --- Data ---
// This is now only used for initializing state
export const TEAMS_MASTER_DATA = [
    { name: 'ינשופים', icon: IMAGE_URLS.TEAM_OWL, iconKey: 'TEAM_OWL' },
    { name: 'שועלים', icon: IMAGE_URLS.TEAM_FOX, iconKey: 'TEAM_FOX' },
    { name: 'פילים', icon: IMAGE_URLS.TEAM_ELEPHANT, iconKey: 'TEAM_ELEPHANT' },
    { name: 'צפרדעים', icon: IMAGE_URLS.TEAM_FROG, iconKey: 'TEAM_FROG' },
    { name: 'אריות', icon: IMAGE_URLS.TEAM_LION, iconKey: 'TEAM_LION' }
];

// --- State ---
// All state variables have been moved to gameState.js.
let scoreAnimationId = null;

// --- Private UI Functions ---

/**
 * Animates a number counting up or down in an HTML element.
 * Plays a counting sound during the animation.
 * @param {HTMLElement} element The element to update.
 * @param {number} start The starting number.
 * @param {number} end The ending number.
 * @param {function} [onComplete=null] - A callback to run when the animation finishes.
 */
function animateScore(element, start, end, onComplete = null) {
    if (scoreAnimationId) {
        cancelAnimationFrame(scoreAnimationId);
        stopSound('scoreCount'); // Stop the previous sound
    }
    if (start === end) {
        element.textContent = end;
        element.classList.remove('score-updating');
        if (onComplete) {
            onComplete();
        }
        return;
    };

    // The duration is fixed to 2 seconds (2500 milliseconds) as requested.
    const duration = 2500;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentNumber = Math.floor(progress * (end - start) + start);
        element.textContent = currentNumber;

        if (progress < 1) {
            scoreAnimationId = window.requestAnimationFrame(step);
        } else {
            element.textContent = end; // Ensure the final value is exact
            element.classList.remove('score-updating');
            stopSound('scoreCount');
            scoreAnimationId = null;
            if (onComplete) {
                onComplete();
            }
        }
    };

    element.classList.add('score-updating');
    playSound('scoreCount');
    scoreAnimationId = window.requestAnimationFrame(step);
}


function generateTeams() {
    mainTeamsContainer.innerHTML = '';
    const { teams } = gameState.getState();

    // Add class for responsive styling if there are many teams
    if (teams.length > 5) {
        mainGameFooter.classList.add('many-teams');
    } else {
        mainGameFooter.classList.remove('many-teams');
    }
        
    teams.forEach(team => {
        const teamElement = document.createElement('div');
        teamElement.className = 'team-member';
        teamElement.dataset.index = team.index;

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'team-icon-wrapper';
        
        const iconContainer = document.createElement('div');
        iconContainer.className = 'team-icon';
        const icon = document.createElement('img');
        icon.src = team.icon;
        icon.alt = team.name;
        iconContainer.appendChild(icon);

        iconWrapper.appendChild(iconContainer);

        if (team.participantId) {
            const phoneIcon = document.createElement('div');
            phoneIcon.className = 'participant-phone-icon';
            phoneIcon.title = 'משתתף מהטלפון';
            phoneIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>`;
            iconWrapper.appendChild(phoneIcon);
        }

        const name = document.createElement('p');
        name.className = 'team-name';
        name.textContent = team.name;

        const scoreWrapper = document.createElement('div');
        scoreWrapper.className = 'team-score-wrapper';

        const score = document.createElement('p');
        score.className = 'team-score';
        score.textContent = team.score;
        score.dataset.score = team.score;
        scoreWrapper.appendChild(score);

        teamElement.appendChild(iconWrapper);
        teamElement.appendChild(name);
        teamElement.appendChild(scoreWrapper);
        mainTeamsContainer.appendChild(teamElement);
    });
}

function updateActiveTeam() {
    const { activeTeamIndex } = gameState.getState();
    const teams = mainTeamsContainer.querySelectorAll('.team-member');
    teams.forEach((team, index) => {
        team.classList.toggle('active', index === activeTeamIndex);
    });
}

function prepareForFinalRound() {
    // Update state for participants and remote to show "Final Round" specific UI
    gameState.setParticipantState('finalRoundPre');
    
    gameScreen.classList.add('hidden');
    showPreQuestionScreen({ isFinalRound: true });
}

/**
 * Gathers the current game state and broadcasts it to participants via Appwrite.
 */
export async function broadcastGameState() {
    const { sessionDocumentId, gameCode, gameName, teams, activeTeamIndex, gameStateForParticipant, finalQuestionData, boxesData, timerEndTime, bettingData } = gameState.getState();
    if (!sessionDocumentId) return;

    // Determine the high-level state for participants
    let currentGameState = gameStateForParticipant || 'waiting'; // Use state if available
    let questionDataForParticipant = null; // Renamed for clarity
    
    if (currentGameState === 'question') {
        const q = getCurrentQuestion();
        questionDataForParticipant = {
            q: q.q,
            timer: q.timer,
            timerEndTime: timerEndTime,
        };
    } else if (currentGameState === 'correctAnswer' || currentGameState === 'learningTime') { // When answer is correct or it's learning time
        const q_and_a = getCurrentQuestion();
        questionDataForParticipant = { q: q_and_a.q, a: q_and_a.a }; // Send Q and A
    } else if (currentGameState === 'finalQuestionActive') {
        // For final question, send the text so they can answer it
        questionDataForParticipant = { q: finalQuestionData.q };
    }

    // Create a "lean" version of the teams array to reduce payload size.
    const leanTeams = teams.map(team => ({
        index: team.index,
        name: team.name,
        iconKey: team.iconKey,
        score: team.score,
        isTaken: team.isTaken,
        participantId: team.participantId
    }));

    const sessionData = {
        gameCode,
        gameName,
        teams: leanTeams, // Send the lean version
        activeTeamIndex,
        gameState: currentGameState,
        currentQuestionData: questionDataForParticipant, // Use new name
        boxesData: boxesData,
        bettingData: bettingData, // Include betting data in broadcast
    };

    try {
        await updateGameSession(sessionDocumentId, sessionData);
    } catch (error) {
        console.error("Failed to broadcast game state:", error);
    }
}

/**
 * Handles actions received from participants via Appwrite Realtime.
 * @param {object} actionPayload - The payload from the `game_actions` document.
 */
async function handleParticipantAction(actionPayload) {
    try {
        const actionData = JSON.parse(actionPayload.actionData);
        const currentState = gameState.getState();

        // --- HOST REMOTE ACTIONS ---
        if (actionData.type.startsWith('remote_')) {
            switch (actionData.type) {
                case 'remote_stop':
                    if (document.getElementById('stop-game-btn').offsetParent !== null) {
                        triggerManualGrading();
                    }
                    break;
                case 'remote_correct':
                    if (document.getElementById('correct-answer-btn').offsetParent !== null) {
                        document.getElementById('correct-answer-btn').click();
                    }
                    break;
                case 'remote_incorrect':
                    if (document.getElementById('incorrect-answer-btn').offsetParent !== null) {
                        document.getElementById('incorrect-answer-btn').click();
                    }
                    break;
                case 'remote_pass':
                    if (document.getElementById('pass-question-btn').offsetParent !== null) {
                        document.getElementById('pass-question-btn').click();
                    }
                    break;
                case 'remote_next':
                    // Logic for "Next" depends on context
                    if (document.getElementById('next-question-btn').offsetParent !== null) {
                        document.getElementById('next-question-btn').click();
                    } else if (document.getElementById('bet-question-btn').offsetParent !== null) {
                         document.getElementById('bet-question-btn').click();
                    } else if (document.getElementById('victory-box-btn').offsetParent !== null) {
                        document.getElementById('victory-box-btn').click();
                    } else if (document.getElementById('return-from-boxes-btn').offsetParent !== null) {
                        document.getElementById('return-from-boxes-btn').click();
                    } else if (document.getElementById('failure-box-btn').offsetParent !== null) {
                         document.getElementById('failure-box-btn').click();
                    }
                    break;
                case 'remote_select_chest':
                    if (document.getElementById('boxes-screen').offsetParent !== null) {
                         await revealChest(actionData.chestIndex);
                    }
                    break;
                case 'remote_pass_to':
                    // 1. Perform the logic to pass the team
                    passQuestionToTeam(actionData.teamIndex);
                    
                    // 2. Update the Desktop UI to match the "Answer Phase" state
                    // (Hide modal if open, hide failure controls, show answer controls)
                    document.getElementById('pass-question-modal-overlay').classList.add('hidden');
                    document.getElementById('failure-controls').classList.add('hidden');
                    document.getElementById('answer-controls').classList.remove('hidden');
                    break;
            }
            return; // Exit after handling remote action
        }


        // --- PARTICIPANT ACTIONS ---
        if (actionData.type === 'selectTeam') {
            const team = currentState.teams.find(t => t.index === actionData.teamIndex);
            
            // This is the critical check to prevent a "race condition".
            // The host checks ITS OWN state to see if the team is still available.
            if (team && !team.isTaken) {
                // Step 1: Update the host's internal state in memory.
                // At this point, the `currentState` object is modified.
                team.isTaken = true;
                team.participantId = actionData.participantId;
                
                // Save the updated state to the gameState module.
                // From now on, any call to gameState.getState() will return the new state.
                gameState.setTeams(currentState.teams); 
                
                // Step 2: Immediately update the host's UI.
                document.dispatchEvent(new CustomEvent('participantjoined', { detail: { teams: currentState.teams } }));

                // Step 3: Broadcast the updated state to Appwrite.
                // The `broadcastGameState` function is called *after* the state has been changed.
                // It will take the updated `currentState` (where isTaken: true)
                // and send it to Appwrite. This ensures the new JSON is sent, not the old one.
                await broadcastGameState();
            }
        } else if (actionData.type === 'stopTimer') {
            if (actionData.teamIndex === currentState.activeTeamIndex) {
                // Check if the timer is actually running
                if (document.getElementById('stop-game-btn').offsetParent !== null) {
                    triggerManualGrading(); // This function will handle its own broadcast
                }
            }
        } else if (actionData.type === 'selectChest') {
            if (actionData.teamIndex === currentState.activeTeamIndex) {
                 // Check if we are in the boxes screen
                if (document.getElementById('boxes-screen').offsetParent !== null) {
                    await revealChest(actionData.chestIndex);
                }
            }
        } else if (actionData.type === 'submitBet') {
            // Handle betting submission
            const teamIndex = actionData.teamIndex;
            const amount = actionData.amount;
            
            // Update global betting state
            gameState.updateTeamBet(teamIndex, amount, true);
            
            // Trigger UI update on Host (re-render cards)
            document.dispatchEvent(new Event('bettingupdate'));

            // Broadcast not strictly necessary here as participant already knows they locked,
            // but good for keeping everyone in sync if there are multiple devices or spectators.
            await broadcastGameState();
        } else if (actionData.type === 'submitFinalAnswer') {
            // Handle final answer submission
            const teamIndex = actionData.teamIndex;
            const text = actionData.text;

            // Update global state
            gameState.updateFinalAnswer(teamIndex, text);

            // Trigger UI update for the host to show "Submitted" status
            document.dispatchEvent(new CustomEvent('finalanswerupdate', { detail: { teamIndex } }));
            
            // NOTE: We do NOT broadcast immediately here. The participant's phone shows "submitted" locally.
            // Broadcasting every keystroke or submission might be overkill, but we can if needed.
        }
    } catch (error) {
        console.error("Error processing participant action:", error);
    }
}


// --- Public (Exported) Functions ---

/**
 * Clears the saved game state by calling the state module.
 */
export function clearGameState() {
    gameState.resetState();
}


/**
 * Gets the current state of the question pass flag from the state module.
 * @returns {boolean}
 */
export function getIsQuestionPassed() {
    return gameState.getState().isQuestionPassed;
}

/**
 * Gets information about the teams currently in the game from the state module.
 * @returns {{teams: Array<object>, activeTeamIndex: number}}
 */
export function getTeamsInfo() {
    const { teams, activeTeamIndex } = gameState.getState();
    return { teams, activeTeamIndex };
}


/**
 * Switches to a specific team when a question is passed.
 * This function acts as a controller, updating both state and UI.
 * @param {number} targetIndex - The index of the team to pass the question to.
 */
export function passQuestionToTeam(targetIndex) {
    gameState.setIsQuestionPassed(true);
    gameState.setActiveTeam(targetIndex);
    // Set state to 'grading' to skip timer and show Correct/Incorrect buttons on remote immediately
    gameState.setParticipantState('grading');
    updateActiveTeam(); // Update UI
    broadcastGameState();
}

export function getCurrentQuestion() {
    const { loadedQuestions, currentQuestionNumber } = gameState.getState();
    if (loadedQuestions.length > 0) {
        // Use modulo to handle potential wrap-around, although logic should prevent it.
        return loadedQuestions[(currentQuestionNumber - 1) % loadedQuestions.length];
    }
    return { q: 'טוען שאלה...', a: '', timer: 30 }; // Fallback
}

export function getFinalQuestionData() {
    return gameState.getState().finalQuestionData;
}

export function getTeamsWithScores() {
    return gameState.getState().teams;
}

export function adjustScore(amount, onAnimationComplete = null, instant = false) {
    const { activeTeamIndex } = gameState.getState();
    adjustScoreForTeam(activeTeamIndex, amount, onAnimationComplete, instant);
}

export function adjustScoreForTeam(teamIndex, amount, onAnimationComplete = null, instant = false) {
    const teamEl = mainTeamsContainer.querySelector(`.team-member[data-index="${teamIndex}"]`);
    if (teamEl) {
        const scoreElement = teamEl.querySelector('.team-score');
        const currentRealScore = parseInt(scoreElement.dataset.score, 10) || 0;
        const endScore = currentRealScore + amount;

        // Update state first
        gameState.updateScore(teamIndex, amount);
        
        // Update the element's data attribute to reflect the new real score
        scoreElement.dataset.score = endScore;
        
        if (instant) {
            scoreElement.textContent = endScore;
            broadcastGameState(); // Broadcast score change
            if (onAnimationComplete) onAnimationComplete();
        } else {
            const startScoreForAnim = parseInt(scoreElement.textContent, 10) || 0;
            // Add broadcast to the animation completion callback
            const onCompleteWithBroadcast = () => {
                broadcastGameState();
                if (onAnimationComplete) onAnimationComplete();
            };
            animateScore(scoreElement, startScoreForAnim, endScore, onCompleteWithBroadcast);
        }
    }
}

export function switchToNextTeam() {
    gameState.setIsQuestionPassed(false);
    gameState.incrementQuestion();
    
    const { currentQuestionNumber, totalQuestions, teams } = gameState.getState();

    if (currentQuestionNumber > totalQuestions) {
        prepareForFinalRound();
        broadcastGameState();
        return;
    }
    
    const newActiveTeamIndex = (currentQuestionNumber - 1) % teams.length;
    gameState.setActiveTeam(newActiveTeamIndex);
    updateActiveTeam();
    
    const { gameName } = gameState.getState();
    const nextQuestion = getCurrentQuestion();
    const questionTime = nextQuestion.timer || 30;

    showPreQuestionScreen({
        gameName,
        currentQuestionNumber,
        totalQuestions,
        startTime: questionTime,
    });

    broadcastGameState();
}

export async function startGame(options) {
    const homeBtn = document.getElementById('global-home-btn');

    // Add central listener for broadcasting state changes
    document.addEventListener('gamestatechange', broadcastGameState);

    if (options.continueLastPoint) {
        const savedState = gameState.getSavedState();
        if (savedState) {
            gameState.loadStateFromObject(savedState);
             // Unsubscribe from any old listeners and subscribe for the new game session
            unsubscribeAllRealtime();
            subscribeToActions(savedState.gameCode, handleParticipantAction);
            
            // Restore UI from loaded state
            generateTeams();
            updateActiveTeam();
            
            document.body.classList.add('game-active');
            mainGameFooter.classList.add('visible');
            if (homeBtn) homeBtn.classList.remove('hidden');
            document.querySelector('.score-controls')?.classList.remove('hidden');

            const { gameName, currentQuestionNumber, totalQuestions } = gameState.getState();
            const currentQuestion = getCurrentQuestion();
            const questionTime = currentQuestion.timer || 30;

            showPreQuestionScreen({
                gameName,
                currentQuestionNumber,
                totalQuestions,
                startTime: questionTime,
            });
            broadcastGameState(); // Sync participants on continue
            return;
        }
    }

    // --- START NEW GAME ---
    // The subscription is now started from the setup screen via an event.
    // No need to subscribe again here.
    const { gameDataString } = options;
    if (!gameDataString) {
        alert('משחק לא תקין נבחר.');
        return;
    }
    const gameData = JSON.parse(gameDataString);
    
    // Initialize the state module
    gameState.initializeState(options, gameData, TEAMS_MASTER_DATA);

    const { totalQuestions } = gameState.getState();

    if (totalQuestions === 0) {
        alert('לא נותרו שאלות למשחק במספר הקבוצות שנבחר. אנא בחר פחות קבוצות או משחק עם יותר שאלות.');
        setupScreen.classList.remove('hidden');
        return;
    }
    
    // Render UI from new state
    generateTeams();
    updateActiveTeam();
    
    document.body.classList.add('game-active');
    mainGameFooter.classList.add('visible');
    if (homeBtn) homeBtn.classList.remove('hidden');
    document.querySelector('.score-controls')?.classList.remove('hidden');

    const { gameName, currentQuestionNumber } = gameState.getState();
    const firstQuestion = getCurrentQuestion();
    const questionTime = firstQuestion.timer || 30;
    
    showPreQuestionScreen({
        gameName,
        currentQuestionNumber,
        totalQuestions,
        startTime: questionTime,
    });
    broadcastGameState(); // Initial broadcast
}


function renderInGameJoinSlots(teams) {
    const container = document.getElementById('in-game-join-teams-container');
    if (!container) return;
    container.innerHTML = '';
    teams.forEach(team => {
        const slot = document.createElement('div');
        slot.className = 'team-slot';
        slot.dataset.index = team.index;
        
        slot.innerHTML = `
            <img src="${team.icon}" alt="${team.name}">
            <button class="kick-participant-btn" title="הסר משתתף">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        `;

        const img = slot.querySelector('img');
        if (team.isTaken) {
            slot.classList.add('filled');
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }
        container.appendChild(slot);
    });
}

function showInGameJoinModal() {
    const { gameCode, teams } = gameState.getState();
    if (!gameCode || !inGameJoinModalOverlay) return;

    const codeDisplay = document.getElementById('in-game-join-code-display');
    if (codeDisplay) codeDisplay.textContent = gameCode;
    
    renderInGameJoinSlots(teams);

    const qrContainer = document.getElementById('in-game-qrcode-container');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        try {
            const url = new URL('participant.html', window.location.href);
            url.searchParams.set('code', gameCode);
            new QRCode(qrContainer, {
                text: url.href,
                width: 256,
                height: 256,
            });
        } catch (e) {
            console.warn("Failed to generate QR Code for in-game join modal.", e);
        }
    }
    
    inGameJoinModalOverlay.classList.remove('hidden');
}

function initializeInGameJoinModal() {
    if (!showJoinInfoBtn || !inGameJoinModalOverlay) return;

    showJoinInfoBtn.addEventListener('click', showInGameJoinModal);
    
    const closeBtn = document.getElementById('close-in-game-join-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => inGameJoinModalOverlay.classList.add('hidden'));
    }
    
    inGameJoinModalOverlay.addEventListener('click', (e) => {
        if (e.target === inGameJoinModalOverlay) {
            inGameJoinModalOverlay.classList.add('hidden');
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !inGameJoinModalOverlay.classList.contains('hidden')) {
            inGameJoinModalOverlay.classList.add('hidden');
        }
    });

    const codeDisplay = document.getElementById('in-game-join-code-display');
    if (codeDisplay) {
        codeDisplay.addEventListener('click', () => {
            navigator.clipboard.writeText(codeDisplay.textContent).then(() => {
                showNotification('הקוד הועתק!', 'success');
            });
        });
    }

    // Listen for join events to update the modal if it's open
    document.addEventListener('participantjoined', (e) => {
        if (!inGameJoinModalOverlay.classList.contains('hidden')) {
            renderInGameJoinSlots(e.detail.teams);
        }
    });

    const inGameTeamsContainer = document.getElementById('in-game-join-teams-container');
    if (inGameTeamsContainer) {
        inGameTeamsContainer.addEventListener('click', (e) => {
            const kickBtn = e.target.closest('.kick-participant-btn');
            if (kickBtn) {
                const slot = kickBtn.closest('.team-slot');
                if (slot) {
                    const teamIndex = parseInt(slot.dataset.index, 10);
                    gameState.unassignParticipant(teamIndex);

                    // Update UI in the modal
                    slot.classList.remove('filled');
                    const img = slot.querySelector('img');
                    if (img) img.style.display = 'none';

                    // Trigger broadcast
                    document.dispatchEvent(new Event('gamestatechange'));
                    showNotification(`המשתתף מקבוצה ${teamIndex + 1} הוסר.`, 'info');
                }
            }
        });
    }
}

export function initializeScoreControls() {
    // Listen for the setup screen being ready to start listening for participants
    document.addEventListener('setupready', (e) => {
        const { gameCode } = e.detail;
        if (gameCode) {
            // Unsubscribe from any previous game/setup listeners before starting a new one.
            unsubscribeAllRealtime();
            subscribeToActions(gameCode, handleParticipantAction);
        }
    });

    // When a participant joins, re-render the footer to show/update phone icons.
    document.addEventListener('participantjoined', () => {
        // Only update the UI if the main game footer is actually visible.
        if (document.body.classList.contains('game-active')) {
            generateTeams();
            updateActiveTeam(); // Re-apply the active team highlight after re-rendering.
        }
    });

    const scoreControls = document.querySelector('.score-controls');
    if (!scoreControls) return;

    scoreControls.addEventListener('click', (e) => {
        const button = e.target.closest('.score-btn');
        if (!button) return;

        if (button.classList.contains('add-point-btn')) {
            adjustScore(5, null, true);
        } else if (button.classList.contains('subtract-point-btn')) {
            adjustScore(-5, null, true);
        }
    });

    initializeInGameJoinModal();
}