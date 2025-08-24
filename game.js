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

let activeTeamIndex = 0;
let currentQuestionNumber = 1;
let gameName = '';
const TOTAL_QUESTIONS = 8;
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
        activeTeamIndex = (activeTeamIndex + 1) % teamCount;
        if (activeTeamIndex === 0) {
            currentQuestionNumber++;
        }
        
        if (currentQuestionNumber > TOTAL_QUESTIONS) {
            alert('המשחק נגמר!');
            document.getElementById('pre-question-screen').classList.add('hidden');
            gameScreen.classList.add('hidden');
            setupScreen.classList.remove('hidden');
            return;
        }

        updateActiveTeam();
        showPreQuestionScreen({
            gameName,
            currentQuestionNumber,
            totalQuestions: TOTAL_QUESTIONS,
            startTime: START_TIME,
        });
    }
}

export function startGame(options) {
    activeTeamIndex = 0;
    currentQuestionNumber = 1;
    gameName = options.gameName;

    generateTeams(options.numberOfGroups);
    updateActiveTeam();
    showPreQuestionScreen({
        gameName,
        currentQuestionNumber,
        totalQuestions: TOTAL_QUESTIONS,
        startTime: START_TIME,
    });
}

export function initializeScoreControls() {
    addPointBtns.forEach(btn => btn.addEventListener('click', () => adjustScore(1)));
    subtractPointBtns.forEach(btn => btn.addEventListener('click', () => adjustScore(-1)));
}
