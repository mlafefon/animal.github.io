
import { showPreQuestionScreen } from './preq.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const mainTeamsContainer = document.getElementById('main-teams-container');
const mainGameFooter = document.getElementById('main-game-footer');
const addPointBtns = document.querySelectorAll('.add-point-btn');
const subtractPointBtns = document.querySelectorAll('.subtract-point-btn');
const setupScreen = document.getElementById('setup-screen');

// --- Data & State ---
const TEAMS_DATA = [
    { name: 'ינשופים', icon: 'images/yanshuf.png' },
    { name: 'שועלים', icon: 'images/fox.png' },
    { name: 'פילים', icon: 'images/pil.png' },
    { name: 'צפרדעים', icon: 'images/frog.png' },
    { name: 'אריות', icon: 'images/lion.png' }
];

let isQuestionPassed = false;
let loadedQuestions = [];
let activeTeamIndex = 0;
let currentQuestionNumber = 1;
let gameName = '';
let totalQuestions = 0;

// --- Private Functions ---

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

        const score = document.createElement('p');
        score.className = 'team-score';
        score.textContent = '0';

        teamElement.appendChild(iconContainer);
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

// --- Public (Exported) Functions ---

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

export function adjustScore(amount) {
    const activeTeam = mainTeamsContainer.querySelector('.team-member.active');
    if (activeTeam) {
        const scoreElement = activeTeam.querySelector('.team-score');
        let currentScore = parseInt(scoreElement.textContent, 10);
        scoreElement.textContent = currentScore + amount;
    }
}

export function switchToNextTeam() {
    isQuestionPassed = false; // Reset the flag for the new turn
    const teamCount = mainTeamsContainer.children.length;
    if (teamCount > 0) {
        // A turn is complete, so we advance to the next question for the next team.
        currentQuestionNumber++;

        // If the new question number exceeds the total, the game is over.
        if (currentQuestionNumber > totalQuestions) {
            alert('המשחק נגמר!');
            document.getElementById('pre-question-screen').classList.add('hidden');
            gameScreen.classList.add('hidden');
            setupScreen.classList.remove('hidden');

            // Hide the persistent footer
            document.body.classList.remove('game-active');
            mainGameFooter.classList.remove('visible');
            return;
        }
        
        // The active team is now determined by the question number, not the previous team.
        // This ensures the rotation is correct even if a question was passed.
        // Question numbers start at 1, so we subtract 1 for a 0-based index.
        activeTeamIndex = (currentQuestionNumber - 1) % teamCount;

        updateActiveTeam();
        
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
    activeTeamIndex = 0;
    currentQuestionNumber = 1;
    isQuestionPassed = false; // Ensure it's reset at the start of a new game
    
    const fileName = options.gameFileName;
    if (!fileName) {
        alert('משחק לא תקין נבחר.');
        return;
    }

    try {
        const response = await fetch(`./data/${fileName}`);
        if (!response.ok) {
            throw new Error(`שגיאת רשת: ${response.status}`);
        }
        const gameData = await response.json();
        loadedQuestions = gameData.questions;
        gameName = gameData.game_name; // The gameName from the file is the source of truth
    } catch (error) {
        console.error("שגיאה בטעינת קובץ השאלות:", error);
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
    addPointBtns.forEach(btn => btn.addEventListener('click', () => adjustScore(1)));
    subtractPointBtns.forEach(btn => btn.addEventListener('click', () => adjustScore(-1)));
}
