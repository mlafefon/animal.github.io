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
 * Fetches game names from the data files and populates the selection list.
 */
async function populateGameList() {
    gameList.innerHTML = ''; // Clear any existing items

    const fetchPromises = DATA_FILES.map(async (fileName) => {
        try {
            const response = await fetch(`./data/${fileName}`);
            if (!response.ok) return null;
            const data = await response.json();
            return { name: data.game_name, file: fileName };
        } catch (error) {
            console.error(`Failed to load game data from ${fileName}:`, error);
            return null;
        }
    });
    
    const games = (await Promise.all(fetchPromises)).filter(Boolean); // Filter out any failed fetches

    games.forEach((game, index) => {
        const li = document.createElement('li');
        li.textContent = game.name;
        li.dataset.fileName = game.file; // Store the filename for later
        if (index === 0) {
            li.classList.add('selected'); // Select the first game by default
        }
        gameList.appendChild(li);
    });
}


/**
 * Initializes the setup screen by attaching event listeners.
 * @param {function} onStart - The callback function to execute when the start button is clicked.
 */
export function initializeSetupScreen(onStart) {
    // Populate the game list dynamically when the app loads
    populateGameList();

    groupList.addEventListener('click', (e) => handleSelection(groupList, e));
    gameList.addEventListener('click', (e) => handleSelection(gameList, e));

    startButton.addEventListener('click', () => {
        setupScreen.classList.add('hidden');
        
        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const selectedGame = gameList.querySelector('.selected');
        // We now pass the filename instead of the display name
        const gameFileName = selectedGame ? selectedGame.dataset.fileName : DATA_FILES[0];

        const shuffleQuestions = document.getElementById('shuffle-questions').checked;

        // Call the provided callback with the selected options
        onStart({ numberOfGroups, gameFileName, shuffleQuestions });
    });
}