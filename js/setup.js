
const groupList = document.getElementById('group-list');
const gameList = document.getElementById('game-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');

// A list of all known game data files.
const DATA_FILES = [
    'cyber_defense.json',
    'log_lifecycle.json',
    'all_about_computers.json',
    'all_about_money.json',
    'cyber_data.json'
];

let gameDataCache = {};


/**
 * Updates the UI with the number of questions in the bank and the calculated
 * number of questions that will actually be used in the game.
 */
function updateQuestionStats() {
    const selectedGameLi = gameList.querySelector('.selected');
    const selectedGroupLi = groupList.querySelector('.selected');
    const questionBankStat = document.getElementById('question-bank-stat');
    const actualQuestionsStat = document.getElementById('actual-questions-stat');

    if (!selectedGameLi || !selectedGroupLi || !questionBankStat || !actualQuestionsStat) {
        return;
    }

    const fileName = selectedGameLi.dataset.fileName;
    const questions = gameDataCache[fileName];
    
    if (!questions) {
        questionBankStat.textContent = 'בנק שאלות: טוען...';
        actualQuestionsStat.textContent = 'שאלות בפועל: טוען...';
        return;
    };

    const questionBankCount = questions.length;
    const numberOfGroups = parseInt(selectedGroupLi.textContent, 10);

    // Calculation: find the largest multiple of numberOfGroups that is <= questionBankCount
    const actualQuestionsCount = Math.floor(questionBankCount / numberOfGroups) * numberOfGroups;

    questionBankStat.textContent = `בנק שאלות: ${questionBankCount}`;
    actualQuestionsStat.textContent = `שאלות בפועל: ${actualQuestionsCount}`;
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
 * Fetches game names from the data files, caches their questions, and populates the selection list.
 */
async function populateGameList() {
    gameList.innerHTML = ''; // Clear any existing items

    const fetchPromises = DATA_FILES.map(async (fileName) => {
        try {
            const response = await fetch(`./data/${fileName}`);
            if (!response.ok) return null;
            const data = await response.json();
            gameDataCache[fileName] = data.questions; // Cache the questions
            return { name: data.game_name, file: fileName };
        } catch (error) {
            console.error(`Failed to load game data from ${fileName}:`, error);
            return null;
        }
    });
    
    const games = (await Promise.all(fetchPromises)).filter(Boolean);

    games.forEach((game, index) => {
        const li = document.createElement('li');
        li.textContent = game.name;
        li.dataset.fileName = game.file; // Store the filename for later
        if (index === 0) {
            li.classList.add('selected'); // Select the first game by default
        }
        gameList.appendChild(li);
    });

    // Initial update after loading and populating
    updateQuestionStats();
}


/**
 * Initializes the setup screen by attaching event listeners.
 * @param {function} onStart - The callback function to execute when the start button is clicked.
 */
export function initializeSetupScreen(onStart) {
    // Populate the game list and trigger the first stat update
    populateGameList();

    groupList.addEventListener('click', (e) => {
        handleSelection(groupList, e);
        updateQuestionStats();
    });
    gameList.addEventListener('click', (e) => {
        handleSelection(gameList, e);
        updateQuestionStats();
    });

    startButton.addEventListener('click', () => {
        setupScreen.classList.add('hidden');
        
        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const selectedGame = gameList.querySelector('.selected');
        const gameFileName = selectedGame ? selectedGame.dataset.fileName : DATA_FILES[0];

        const shuffleQuestions = document.getElementById('shuffle-questions').checked;

        // Get the calculated number of questions from the UI to pass to the game logic
        const actualQuestionsText = document.getElementById('actual-questions-stat').textContent;
        const actualQuestions = parseInt(actualQuestionsText.split(':')[1].trim(), 10) || 0;

        onStart({ numberOfGroups, gameFileName, shuffleQuestions, actualQuestions });
    });
}