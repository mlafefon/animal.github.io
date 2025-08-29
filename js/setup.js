const groupList = document.getElementById('group-list');
const gameList = document.getElementById('game-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');

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
 * Fetches game names from a manifest file, caches their questions, and populates the selection list.
 */
async function populateGameList() {
    gameList.innerHTML = ''; // Clear any existing items

    try {
        const manifestResponse = await fetch('./data/manifest.json');
        if (!manifestResponse.ok) {
            throw new Error('Could not load game manifest.');
        }
        const DATA_FILES = await manifestResponse.json();

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
            // Add attributes for accessibility and keyboard navigation
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');
            gameList.appendChild(li);
        });

        // Initial update after loading and populating
        updateQuestionStats();

    } catch (error) {
        console.error('Failed to populate game list:', error);
        gameList.innerHTML = '<li>שגיאה בטעינת רשימת המשחקים</li>';
    }
}


/**
 * Initializes the setup screen by attaching event listeners.
 * @param {function} onStart - The callback function to execute when the start button is clicked.
 */
export function initializeSetupScreen(onStart) {
    // Add accessibility attributes to static group list items
    groupList.querySelectorAll('li').forEach(li => {
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
    });

    const continueCheckbox = document.getElementById('continue-last-point');
    const continueLabel = document.querySelector('label[for="continue-last-point"]');
    let savedState = null; // Store the parsed state to reuse it

    /**
     * Toggles the enabled/disabled state of the main setup controls.
     * @param {boolean} disabled - True to disable, false to enable.
     */
    function toggleSetupControls(disabled) {
        groupList.style.pointerEvents = disabled ? 'none' : 'auto';
        groupList.style.opacity = disabled ? 0.6 : 1;
        gameList.style.pointerEvents = disabled ? 'none' : 'auto';
        gameList.style.opacity = disabled ? 0.6 : 1;
        document.getElementById('shuffle-questions').disabled = disabled;
    }

    /**
     * Selects the group and game list items based on the loaded saved game state.
     */
    function applySavedStateSelections() {
        if (!savedState) return;

        // Select Number of Groups
        const numberOfGroups = savedState.teams.length;
        [...groupList.children].forEach(li => {
            li.classList.toggle('selected', parseInt(li.textContent, 10) === numberOfGroups);
        });

        // Select Game
        const gameFileName = savedState.options.gameFileName;
        [...gameList.children].forEach(li => {
            li.classList.toggle('selected', li.dataset.fileName === gameFileName);
        });
        
        updateQuestionStats();
    }


    // Check for saved state on initialization
    const savedStateJSON = localStorage.getItem('animalGameState');
    if (savedStateJSON) {
        try {
            savedState = JSON.parse(savedStateJSON);
            continueCheckbox.disabled = false;
            continueLabel.textContent = `המשך "${savedState.gameName}"`;
        } catch (e) {
            // Handle corrupted saved data
            continueCheckbox.disabled = true;
            continueCheckbox.checked = false;
            continueLabel.textContent = 'המשך מנקודה אחרונה';
            localStorage.removeItem('animalGameState');
            savedState = null; // Clear corrupted state
        }
    } else {
        continueCheckbox.disabled = true;
        continueCheckbox.checked = false;
        continueLabel.textContent = 'המשך מנקודה אחרונה';
    }
    
    // Set initial state of controls based on checkbox
    toggleSetupControls(continueCheckbox.checked);

    // Add listener to toggle controls when checkbox changes
    continueCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        toggleSetupControls(isChecked);
        if (isChecked) {
            applySavedStateSelections();
        }
    });

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
        // Fallback to the first available game if none is somehow selected
        const gameFileName = selectedGame ? selectedGame.dataset.fileName : (gameList.querySelector('li')?.dataset.fileName || '');


        const shuffleQuestions = document.getElementById('shuffle-questions').checked;
        const continueLastPoint = continueCheckbox.checked;

        // Get the calculated number of questions from the UI to pass to the game logic
        const actualQuestionsText = document.getElementById('actual-questions-stat').textContent;
        const actualQuestions = parseInt(actualQuestionsText.split(':')[1].trim(), 10) || 0;

        onStart({ numberOfGroups, gameFileName, shuffleQuestions, actualQuestions, continueLastPoint });
    });
}
