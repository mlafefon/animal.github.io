import { showPreQuestionScreen } from './preq.js';

// --- Elements ---
const gameScreen = document.getElementById('game-screen');
const teamsContainers = document.querySelectorAll('.teams-container');
const addPointBtns = document.querySelectorAll('.add-point-btn');
const subtractPointBtns = document.querySelectorAll('.subtract-point-btn');
const setupScreen = document.getElementById('setup-screen');

// --- Data & State ---
const TEAMS_DATA = [
    { name: 'Eagle', icon: 'https://cdn-icons-png.flaticon.com/512/3037/3037237.png' },
    { name: 'Fox', icon: 'https://cdn-icons-png.flaticon.com/512/1059/1059021.png' },
    { name: 'Elephant', icon: 'https://cdn-icons-png.flaticon.com/512/3037/3037229.png' },
    { name: 'Frog', icon: 'https://cdn-icons-png.flaticon.com/512/3069/3069229.png' }
];

let loadedQuestions = [];
let activeTeamIndex = 0;
let currentQuestionNumber = 1;
let gameName = '';
let totalQuestions = 0;
const START_TIME = 30;

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
    return { q: 'טוען שאלה...', a: '' }; // Fallback
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
        showPreQuestionScreen({
            gameName,
            currentQuestionNumber,
            totalQuestions: totalQuestions,
            startTime: START_TIME,
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

    totalQuestions = loadedQuestions.length;

    generateTeams(options.numberOfGroups);
    updateActiveTeam();
    showPreQuestionScreen({
        gameName,
        currentQuestionNumber,
        totalQuestions: totalQuestions,
        startTime: START_TIME,
    });
}

export function initializeScoreControls() {
    addPointBtns.forEach(btn => btn.addEventListener('click', () => adjustScore(1)));
    subtractPointBtns.forEach(btn => btn.addEventListener('click', () => adjustScore(-1)));
}