import { showPreQuestionScreen } from './preq.js';
import { playSound, stopSound } from './audio.js';
import { IMAGE_URLS } from './assets.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const mainTeamsContainer = document.getElementById('main-teams-container');
const mainGameFooter = document.getElementById('main-game-footer');
const setupScreen = document.getElementById('setup-screen');

// --- Data & State ---
const TEAMS_DATA = [
    { name: 'ינשופים', icon: IMAGE_URLS.TEAM_OWL },
    { name: 'שועלים', icon: IMAGE_URLS.TEAM_FOX },
    { name: 'פילים', icon: IMAGE_URLS.TEAM_ELEPHANT },
    { name: 'צפרדעים', icon: IMAGE_URLS.TEAM_FROG },
    { name: 'אריות', icon: IMAGE_URLS.TEAM_LION }
];

let isQuestionPassed = false;
let loadedQuestions = [];
let finalQuestionData = null;
let activeTeamIndex = 0;
let currentQuestionNumber = 1;
let gameName = '';
let totalQuestions = 0;
let currentGameOptions = {}; // To store options for saving state
let scoreAnimationId = null;

// --- Private Functions ---

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


/**
 * Saves the current game state to localStorage.
 */
function saveGameState() {
    // Don't save if the game hasn't started or has no questions
    if (!loadedQuestions || loadedQuestions.length === 0) return;

    const gameState = {
        activeTeamIndex,
        currentQuestionNumber,
        loadedQuestions,
        finalQuestionData,
        gameName,
        totalQuestions,
        teams: getTeamsWithScores(), // Captures current scores
        options: currentGameOptions,
    };

    try {
        localStorage.setItem('animalGameState', JSON.stringify(gameState));
    } catch (error) {
        console.error("Failed to save game state:", error);
    }
}


function generateTeams(count) {
    mainTeamsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const team = TEAMS_DATA[i % TEAMS_DATA.length];
        const teamElement = document.createElement('div');
        teamElement.className = 'team-member';
        teamElement.dataset.index = i;

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
        score.textContent = '0';
        score.dataset.score = '0';

        teamElement.appendChild(iconContainer);
        teamElement.appendChild(name);
        teamElement.appendChild(score);
        mainTeamsContainer.appendChild(teamElement);
    }
}

function updateActiveTeam() {
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
 * Clears any saved game state from localStorage.
 */
export function clearGameState() {
    localStorage.removeItem('animalGameState');
}


/**
 * Gets the current state of the question pass flag.
 * @returns {boolean}
 */
export function getIsQuestionPassed() {
    return isQuestionPassed;
}

/**
 * Gets information about the teams currently in the game.
 * @returns {{teams: Array<{index: number, name: string, icon: string}>, activeTeamIndex: number}}
 */
export function getTeamsInfo() {
    const teamCount = mainTeamsContainer.children.length;
    const teams = [];

    for (let i = 0; i < teamCount; i++) {
        // Reconstruct the team info directly from the master TEAMS_DATA array
        const teamData = TEAMS_DATA[i % TEAMS_DATA.length];
        teams.push({
            index: i,
            name: teamData.name,
            icon: teamData.icon
        });
    }

    return {
        teams,
        activeTeamIndex
    };
}


/**
 * Switches to a specific team when a question is passed.
 * @param {number} targetIndex - The index of the team to pass the question to.
 */
export function passQuestionToTeam(targetIndex) {
    isQuestionPassed = true; // Mark that the question has been passed
    const teamCount = mainTeamsContainer.children.length;
    if (teamCount > 0 && targetIndex >= 0 && targetIndex < teamCount) {
        activeTeamIndex = targetIndex;
        updateActiveTeam();
        saveGameState(); // Save state after team change
    } else {
        console.error(`Invalid targetIndex ${targetIndex} for passing question.`);
    }
}

export function getCurrentQuestion() {
    // We use currentQuestionNumber which starts at 1. The array is 0-indexed.
    if (loadedQuestions.length > 0) {
        return loadedQuestions[(currentQuestionNumber - 1) % loadedQuestions.length];
    }
    return { q: 'טוען שאלה...', a: '', timer: 30 }; // Fallback
}

export function getFinalQuestionData() {
    return finalQuestionData;
}

export function getTeamsWithScores() {
    const teams = mainTeamsContainer.querySelectorAll('.team-member');
    const teamData = [];
    teams.forEach((team) => {
        const index = parseInt(team.dataset.index, 10);
        const teamInfo = TEAMS_DATA[index % TEAMS_DATA.length];
        const scoreElement = team.querySelector('.team-score');
        // Read from data-score attribute, not textContent, to get the "real" score
        const score = parseInt(scoreElement.dataset.score, 10);
        teamData.push({
            index,
            name: teamInfo.name,
            icon: teamInfo.icon,
            score
        });
    });
    return teamData;
}

export function adjustScore(amount, onAnimationComplete = null, instant = false) {
    const activeTeam = mainTeamsContainer.querySelector('.team-member.active');
    if (activeTeam) {
        const scoreElement = activeTeam.querySelector('.team-score');
        const currentRealScore = parseInt(scoreElement.dataset.score, 10) || 0;
        const endScore = currentRealScore + amount;

        // Update the "real" score and save state
        scoreElement.dataset.score = endScore;
        saveGameState();
        
        if (instant) {
            // Instantly update the display and call the callback if it exists
            scoreElement.textContent = endScore;
            if (onAnimationComplete) {
                onAnimationComplete();
            }
        } else {
            // Trigger the visual animation for non-instant updates
            const startScore = parseInt(scoreElement.textContent, 10) || 0;
            animateScore(scoreElement, startScore, endScore, onAnimationComplete);
        }
    }
}

export function adjustScoreForTeam(teamIndex, amount, onAnimationComplete = null, instant = false) {
    const team = mainTeamsContainer.querySelector(`.team-member[data-index="${teamIndex}"]`);
    if (team) {
        const scoreElement = team.querySelector('.team-score');
        // 'startScore' is only needed for animation.
        const currentRealScore = parseInt(scoreElement.dataset.score, 10) || 0;
        const endScore = currentRealScore + amount;

        // 1. Update the "real" score in the data attribute
        scoreElement.dataset.score = endScore;
        // 2. Save the state with the new real score
        saveGameState();
        // 3. Trigger the visual animation or update instantly
        if (instant) {
            scoreElement.textContent = endScore;
            if (onAnimationComplete) {
                onAnimationComplete();
            }
        } else {
            const startScore = parseInt(scoreElement.textContent, 10) || 0;
            animateScore(scoreElement, startScore, endScore, onAnimationComplete);
        }
    }
}

export function switchToNextTeam() {
    isQuestionPassed = false; // Reset the flag for the new turn
    const teamCount = mainTeamsContainer.children.length;
    if (teamCount > 0) {
        // A turn is complete, so we advance to the next question for the next team.
        currentQuestionNumber++;

        // If the new question number exceeds the total, start the final round.
        if (currentQuestionNumber > totalQuestions) {
            prepareForFinalRound();
            return;
        }
        
        // The active team is now determined by the question number, not the previous team.
        // This ensures the rotation is correct even if a question was passed.
        // Question numbers start at 1, so we subtract 1 for a 0-based index.
        activeTeamIndex = (currentQuestionNumber - 1) % teamCount;

        updateActiveTeam();
        saveGameState(); // Save state after advancing turn
        
        const nextQuestion = getCurrentQuestion();
        // Use the timer from the question, with a fallback of 30 seconds.
        const questionTime = nextQuestion.timer || 30;

        showPreQuestionScreen({
            gameName,
            currentQuestionNumber,
            totalQuestions: totalQuestions,
            startTime: questionTime,
        });
    }
}

export async function startGame(options) {
    const continueLastPoint = options.continueLastPoint;
    const savedStateJSON = localStorage.getItem('animalGameState');
    const homeBtn = document.getElementById('global-home-btn');

    // --- LOAD SAVED GAME ---
    if (continueLastPoint && savedStateJSON) {
        const savedState = JSON.parse(savedStateJSON);

        // Restore state variables
        activeTeamIndex = savedState.activeTeamIndex;
        currentQuestionNumber = savedState.currentQuestionNumber;
        loadedQuestions = savedState.loadedQuestions;
        finalQuestionData = savedState.finalQuestionData;
        gameName = savedState.gameName;
        totalQuestions = savedState.totalQuestions;
        currentGameOptions = savedState.options;
        isQuestionPassed = false; // Always reset this flag on load

        // Restore UI
        generateTeams(savedState.teams.length);
        savedState.teams.forEach(team => {
            // Directly set the score text content to avoid re-triggering save
            const scoreElement = mainTeamsContainer.querySelector(`.team-member[data-index="${team.index}"] .team-score`);
            if (scoreElement) {
                scoreElement.textContent = team.score;
                scoreElement.dataset.score = team.score;
            }
        });
        updateActiveTeam();
        
        document.body.classList.add('game-active');
        mainGameFooter.classList.add('visible');
        if (homeBtn) homeBtn.classList.remove('hidden');
        
        const scoreControls = document.querySelector('.score-controls');
        if (scoreControls) scoreControls.classList.remove('hidden');

        // Go to pre-question screen for the saved question
        const currentQuestion = getCurrentQuestion();
        const questionTime = currentQuestion.timer || 30;

        showPreQuestionScreen({
            gameName,
            currentQuestionNumber,
            totalQuestions,
            startTime: questionTime,
        });
        return; // Exit function after loading
    }
    
    // --- START NEW GAME ---
    clearGameState(); // Clear any old state if not continuing
    activeTeamIndex = 0;
    currentQuestionNumber = 1;
    isQuestionPassed = false;
    currentGameOptions = options; // Store options for the new game
    
    const { documentId, gameDataString, gameName: gameNameFromOptions } = options;
    if (!documentId || !gameDataString) {
        alert('משחק לא תקין נבחר.');
        return;
    }

    try {
        const gameData = JSON.parse(gameDataString);
        loadedQuestions = gameData.questions;
        finalQuestionData = gameData.final_question;
        gameName = gameNameFromOptions || gameData.game_name;
    } catch (error) {
        console.error("שגיאה בפענוח נתוני המשחק:", error);
        alert("שגיאה בטעינת השאלות. אנא נסה שוב.");
        setupScreen.classList.remove('hidden');
        return;
    }

    if (options.shuffleQuestions) {
        // Fisher-Yates shuffle algorithm
        for (let i = loadedQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [loadedQuestions[i], loadedQuestions[j]] = [loadedQuestions[j], loadedQuestions[i]];
        }
    }

    // Slice the array to the calculated number of questions.
    // This happens AFTER shuffling to ensure a random subset is chosen.
    const { actualQuestions } = options;
    if (actualQuestions > 0 && actualQuestions <= loadedQuestions.length) {
        loadedQuestions = loadedQuestions.slice(0, actualQuestions);
    }

    totalQuestions = loadedQuestions.length;

    // Check if there are any questions left to play.
    if (totalQuestions === 0) {
        alert('לא נותרו שאלות למשחק במספר הקבוצות שנבחר. אנא בחר פחות קבוצות או משחק עם יותר שאלות.');
        setupScreen.classList.remove('hidden');
        return;
    }

    generateTeams(options.numberOfGroups);
    updateActiveTeam();
    
    // Show the persistent footer
    document.body.classList.add('game-active');
    mainGameFooter.classList.add('visible');
    if (homeBtn) homeBtn.classList.remove('hidden');


    // Make sure the manual score controls are visible at the start of a new game
    const scoreControls = document.querySelector('.score-controls');
    if (scoreControls) {
        scoreControls.classList.remove('hidden');
    }

    saveGameState(); // Initial save for the new game

    const firstQuestion = getCurrentQuestion();
    // Use the timer from the question, with a fallback of 30 seconds.
    const questionTime = firstQuestion.timer || 30;

    showPreQuestionScreen({
        gameName,
        currentQuestionNumber,
        totalQuestions: totalQuestions,
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