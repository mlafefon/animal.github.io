import { showPreQuestionScreen } from './preq.js';
import { playSound, stopSound } from './audio.js';
import { IMAGE_URLS } from './assets.js';
import * as gameState from './gameState.js';
import { subscribeToActions, updateGameSession } from './appwriteService.js';
import { triggerManualGrading } from './question.js';
import { showBoxesScreen, revealSelectedBox } from './boxes.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const mainTeamsContainer = document.getElementById('main-teams-container');
const mainGameFooter = document.getElementById('main-game-footer');
const setupScreen = document.getElementById('setup-screen');

// --- Data ---
// This is now only used for initializing state
export const TEAMS_MASTER_DATA = [
    { name: 'ינשופים', icon: IMAGE_URLS.TEAM_OWL },
    { name: 'שועלים', icon: IMAGE_URLS.TEAM_FOX },
    { name: 'פילים', icon: IMAGE_URLS.TEAM_ELEPHANT },
    { name: 'צפרדעים', icon: IMAGE_URLS.TEAM_FROG },
    { name: 'אריות', icon: IMAGE_URLS.TEAM_LION }
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

        const iconContainer = document.createElement('div');
        iconContainer.className = 'team-icon';
        const icon = document.createElement('img');
        icon.src = team.icon;
        icon.alt = team.name;
        iconContainer.appendChild(icon);

        const name = document.createElement('p');
        name.className = 'team-name';
        name.textContent = team.name;

        const score = document.createElement('p');
        score.className = 'team-score';
        score.textContent = team.score;
        score.dataset.score = team.score;

        teamElement.appendChild(iconContainer);
        teamElement.appendChild(name);
        teamElement.appendChild(score);
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
    gameScreen.classList.add('hidden');
    showPreQuestionScreen({ isFinalRound: true });
}

/**
 * Gathers the current game state and broadcasts it to participants via Appwrite.
 */
async function broadcastGameState() {
    const state = gameState.getState();
    const { sessionDocumentId, gameCode, gameName, teams, activeTeamIndex, victoryType } = state;
    if (!sessionDocumentId) return;

    // Determine the high-level state for participants
    let currentGameState = 'waiting';
    if (document.getElementById('boxes-screen').offsetParent !== null && !document.getElementById('return-from-boxes-btn').classList.contains('visible')) {
        currentGameState = 'box-selection';
    } else if (document.getElementById('pre-question-screen').offsetParent !== null) {
        currentGameState = 'pre-question';
    } else if (document.getElementById('game-screen').offsetParent !== null && document.getElementById('stop-game-btn').offsetParent !== null) {
        currentGameState = 'question';
    } else if (document.getElementById('game-screen').offsetParent !== null) {
        currentGameState = 'grading';
    } else if (document.getElementById('betting-screen').offsetParent !== null) {
        currentGameState = 'betting';
    }

    let questionForParticipant = null;
    if (currentGameState === 'question') {
        const q = getCurrentQuestion();
        questionForParticipant = { q: q.q }; // Only send the question text
    }

    const sessionData = {
        gameCode,
        gameName,
        teams,
        activeTeamIndex,
        gameState: currentGameState,
        currentQuestion: questionForParticipant,
        victoryType: victoryType
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

        if (actionData.type === 'selectTeam') {
            const team = currentState.teams.find(t => t.index === actionData.teamIndex);
            if (team && !team.isTaken) {
                team.isTaken = true;
                gameState.setTeams(currentState.teams); // Update internal state
                await broadcastGameState(); // Broadcast change to all participants
            }
        } else if (actionData.type === 'stopTimer') {
            if (actionData.teamIndex === currentState.activeTeamIndex) {
                if (document.getElementById('stop-game-btn').offsetParent !== null) {
                    triggerManualGrading();
                }
            }
        } else if (actionData.type === 'selectBox') {
            if (actionData.teamIndex === currentState.activeTeamIndex) {
                revealSelectedBox(actionData.boxIndex);
            }
        }
    } catch (error) {
        console.error("Error processing participant action:", error);
    }
}


// --- Public (Exported) Functions ---

/**
 * Initiates the box selection process on the participant's device.
 * @param {string} victoryType - 'victory' or 'half-victory'.
 */
export function startRemoteBoxSelection(victoryType) {
    let scores;
    if (victoryType === 'half-victory') {
        scores = [5, 10, 15, 20, 25];
    } else {
        scores = [10, 20, 30, 40, 50];
    }
    
    for (let i = scores.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scores[i], scores[j]] = [scores[j], scores[i]];
    }
    
    const state = gameState.getState();
    state.boxScores = scores.slice(0, 3);
    state.victoryType = victoryType;
    // This updates the internal state, but doesn't save to localStorage, which is correct for transient data.
    
    showBoxesScreen({ mode: 'waiting', victoryType });
    broadcastGameState();
}

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

    if (options.continueLastPoint) {
        const savedState = gameState.getSavedState();
        if (savedState) {
            gameState.loadStateFromObject(savedState);
             // Subscribe to actions for the existing game session
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
    
    // Subscribe to actions from participants for the new game
    subscribeToActions(options.gameCode, handleParticipantAction);

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

export function initializeScoreControls() {
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
}