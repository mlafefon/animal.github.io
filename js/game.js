import { showPreQuestionScreen } from './preq.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const teamsContainers = document.querySelectorAll('.teams-container');
const addPointBtns = document.querySelectorAll('.add-point-btn');
const subtractPointBtns = document.querySelectorAll('.subtract-point-btn');
const setupScreen = document.getElementById('setup-screen');

// --- Data & State ---
const TEAMS_DATA = [
    { name: 'ינשוף', icon: '/images/yanshuf.png' },
    { name: 'שועל', icon: 'https://cdn-icons-png.flaticon.com/512/2823/2823035.png' },
    { name: 'פיל', icon: 'images/pil.png' },
    { name: 'צפרדע', icon: 'https://cdn-icons-png.flaticon.com/512/1076/1076931.png' },
    { name: 'אריה', icon: 'https://cdn-icons-png.flaticon.com/512/3069/3069225.png' }
];

let loadedQuestions = [];
let activeTeamIndex = 0;
let currentQuestionNumber = 1;
let gameName = '';
let totalQuestions = 0;

// --- Private Functions ---

function generateTeams(count) {
    teamsContainers.forEach(container => {
        container.innerHTML = '';
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
            container.appendChild(teamElement);
        }
    });
}

function updateActiveTeam() {
    teamsContainers.forEach(container => {
        const teams = container.querySelectorAll('.team-member');
        teams.forEach((team, index) => {
            team.classList.toggle('active', index === activeTeamIndex);
        });
    });
}

// --- Public (Exported) Functions ---

export function getCurrentQuestion() {
    // We use currentQuestionNumber which starts at 1. The array is 0-indexed.
    if (loadedQuestions.length > 0) {
        return loadedQuestions[(currentQuestionNumber - 1) % loadedQuestions.length];
    }
    return { q: 'טוען שאלה...', a: '', timer: 30 }; // Fallback
}

export function adjustScore(amount) {
    teamsContainers.forEach(container => {
        const activeTeam = container.querySelector('.team-member.active');
        if (activeTeam) {
            const scoreElement = activeTeam.querySelector('.team-score');
            let currentScore = parseInt(scoreElement.textContent, 10);
            scoreElement.textContent = currentScore + amount;
        }
    });
}

export function switchToNextTeam() {
    const teamCount = teamsContainers[0].children.length;
    if (teamCount > 0) {
        // A turn is complete, so we advance to the next question for the next team.
        currentQuestionNumber++;

        // If the new question number exceeds the total, the game is over.
        if (currentQuestionNumber > totalQuestions) {
            alert('המשחק נגמר!');
            document.getElementById('pre-question-screen').classList.add('hidden');
            gameScreen.classList.add('hidden');
            setupScreen.classList.remove('hidden');
            return;
        }
        
        // Cycle to the next team.
        activeTeamIndex = (activeTeamIndex + 1) % teamCount;

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