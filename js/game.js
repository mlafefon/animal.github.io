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

const QUESTIONS = [
    { q: 'איך אוכל לזהות שהאתר שאליו אני גולש הוא מאובטח', a: 'האתר אמור להתחיל ב https או שיש לו סימן של מנעול' },
    { q: 'מהי מתקפת פישינג?', a: 'ניסיון לגנוב מידע רגיש (כמו שמות משתמש וסיסמאות) על ידי התחזות לישות מהימנה.' },
    { q: 'מה תפקידה של חומת אש (Firewall)?', a: 'לפקח על תעבורת הרשת הנכנסת והיוצאת ולחסום תעבורה חשודה על בסיס כללי אבטחה.' },
    { q: 'מהי הנדסה חברתית?', a: 'מניפולציה פסיכולוגית של אנשים כדי שיבצעו פעולות או ימסרו מידע סודי.' },
    { q: 'מהו וירוס כופר (Ransomware)?', a: 'תוכנה זדונית המצפינה את קבצי הקורבן ודורשת תשלום כופר עבור שחרורם.' },
    { q: 'מהי אימות דו-שלבי (2FA)?', a: 'שיטת אבטחה הדורשת שתי דרכי זיהוי שונות כדי לגשת לחשבון.' },
    { q: 'מדוע חשוב לעדכן תוכנות באופן קבוע?', a: 'עדכונים כוללים לעיתים קרובות תיקוני אבטחה החוסמים פרצות שהתגלו.' },
    { q: 'מהו "ענן" במחשוב?', a: 'רשת של שרתים מרוחקים המאפשרת לאחסן, לנהל ולעבד נתונים דרך האינטרנט.' }
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

export function getCurrentQuestion() {
    // We use currentQuestionNumber which starts at 1. The array is 0-indexed.
    return QUESTIONS[(currentQuestionNumber - 1) % QUESTIONS.length];
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