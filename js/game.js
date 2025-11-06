import { showPreQuestionScreen } from './preq.js';
import { playSound, stopSound } from './audio.js';
import { IMAGE_URLS } from './assets.js';
import * as gameState from './gameState.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const mainTeamsContainer = document.getElementById('main-teams-container');
const mainGameFooter = document.getElementById('main-game-footer');
const setupScreen = document.getElementById('setup-screen');

// --- Data ---
// This is now only used for initializing state
const TEAMS_MASTER_DATA = [
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
    updateActiveTeam(); // Update UI
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
            if (onAnimationComplete) onAnimationComplete();
        } else {
            const startScoreForAnim = parseInt(scoreElement.textContent, 10) || 0;
            animateScore(scoreElement, startScoreForAnim, endScore, onAnimationComplete);
        }
    }
}

export function switchToNextTeam() {
    gameState.setIsQuestionPassed(false);
    gameState.incrementQuestion();
    
    const { currentQuestionNumber, totalQuestions, teams } = gameState.getState();

    if (currentQuestionNumber > totalQuestions) {
        prepareForFinalRound();
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
}

export async function startGame(options) {
    const homeBtn = document.getElementById('global-home-btn');

    if (options.continueLastPoint) {
        const savedState = gameState.getSavedState();
        if (savedState) {
            gameState.loadStateFromObject(savedState);
            
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
