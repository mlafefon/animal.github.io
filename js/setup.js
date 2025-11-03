import { listGames, listCategories, getFileUrl } from './appwriteService.js';

const groupList = document.getElementById('group-list');
const gameList = document.getElementById('game-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');
const categoryListContainer = document.getElementById('category-list-container');


let gameDataCache = {};


/**
 * Updates the UI with the number of questions in the bank and the calculated
 * number of questions that will actually be used in the game. It also enables/disables
 * the start button based on the number of actual questions.
 */
function updateQuestionStats() {
    const selectedGameLi = gameList.querySelector('.selected');
    const selectedGroupLi = groupList.querySelector('.selected');
    const questionBankStat = document.getElementById('question-bank-stat');
    const actualQuestionsStat = document.getElementById('actual-questions-stat');

    if (!selectedGroupLi || !questionBankStat || !actualQuestionsStat) {
        return;
    }
    
    // If no game is selected, show a default message
    if (!selectedGameLi) {
        questionBankStat.textContent = 'בנק שאלות: --';
        actualQuestionsStat.textContent = 'שאלות בפועל: --';
        startButton.disabled = true;
        startButton.title = 'יש לבחור משחק';
        return;
    }

    const documentId = selectedGameLi.dataset.documentId;
    const gameData = gameDataCache[documentId];
    
    if (!gameData) {
        questionBankStat.textContent = 'בנק שאלות: טוען...';
        actualQuestionsStat.textContent = 'שאלות בפועל: טוען...';
        startButton.disabled = true; // Disable if data is not loaded yet
        return;
    };

    const questionBankCount = gameData.questions.length;
    const numberOfGroups = parseInt(selectedGroupLi.textContent, 10);

    const actualQuestionsCount = Math.floor(questionBankCount / numberOfGroups) * numberOfGroups;

    questionBankStat.textContent = `בנק שאלות: ${questionBankCount}`;
    actualQuestionsStat.textContent = `שאלות בפועל: ${actualQuestionsCount}`;

    const canContinue = document.getElementById('continue-last-point').checked;
    
    // Disable start button if there are no questions for a new game
    if (actualQuestionsCount === 0 && !canContinue) {
        startButton.disabled = true;
        startButton.title = 'לא ניתן להתחיל משחק ללא שאלות. יש לבחור פחות קבוצות.';
    } else {
        startButton.disabled = false;
        startButton.title = '';
    }
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
 * Fetches games for a specific category and populates the selection list.
 * @param {string|null} categoryId - The ID of the category to filter by. Null for all games.
 */
async function populateGameList(categoryId) {
    gameList.innerHTML = '<li>טוען משחקים...</li>';
    gameDataCache = {};
    updateQuestionStats(); // Clear stats while loading

    try {
        const games = await listGames(categoryId);
        gameList.innerHTML = '';

        if (games.length === 0) {
            gameList.innerHTML = '<li>לא נמצאו משחקים בקטגוריה זו.</li>';
            updateQuestionStats(); // Update stats to show no games
            return;
        }

        games.forEach((game, index) => {
            try {
                const fullGameData = JSON.parse(game.game_data);
                gameDataCache[game.$id] = fullGameData;

                const li = document.createElement('li');
                li.textContent = game.game_name;
                li.dataset.documentId = game.$id;
                li.dataset.gameData = game.game_data;

                if (index === 0) {
                    li.classList.add('selected');
                }
                
                li.setAttribute('role', 'button');
                li.setAttribute('tabindex', '0');
                gameList.appendChild(li);
            } catch (parseError) {
                console.error(`Could not parse game data for "${game.game_name}"`, parseError);
            }
        });
        updateQuestionStats();
    } catch (error) {
        console.error('Failed to populate game list:', error);
        gameList.innerHTML = '<li>שגיאה בטעינת רשימת המשחקים</li>';
    }
}

/**
 * Fetches and renders the category selection cards.
 */
async function renderCategories() {
    categoryListContainer.innerHTML = '<span>טוען קטגוריות...</span>';
    
    try {
        const categories = await listCategories();
        categoryListContainer.innerHTML = '';

        // Create and prepend the "All" category card
        const allCard = document.createElement('div');
        allCard.className = 'category-card selected'; // Selected by default
        allCard.dataset.categoryId = 'all';
        allCard.innerHTML = `
            <img src="https://img.icons8.com/plasticine/100/question-mark.png" alt="הכל">
            <span>הכל</span>
        `;
        categoryListContainer.appendChild(allCard);

        categories.forEach(category => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.categoryId = category.$id;
            const imageUrl = category.imageId ? getFileUrl(category.imageId) : 'https://img.icons8.com/plasticine/100/folder-invoices.png';
            card.innerHTML = `
                <img src="${imageUrl}" alt="${category.name}">
                <span>${category.name}</span>
            `;
            categoryListContainer.appendChild(card);
        });

        // Add a single event listener to the container
        categoryListContainer.addEventListener('click', (e) => {
            const selectedCard = e.target.closest('.category-card');
            if (!selectedCard) return;

            // Update selection visual
            categoryListContainer.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
            selectedCard.classList.add('selected');

            // Repopulate games based on selection
            const categoryId = selectedCard.dataset.categoryId;
            populateGameList(categoryId === 'all' ? null : categoryId);
        });

    } catch (error) {
        console.error("Failed to render categories:", error);
        categoryListContainer.innerHTML = '<span>שגיאה בטעינת קטגוריות</span>';
    }
}


/**
 * Toggles the enabled/disabled state of the main setup controls.
 * @param {boolean} disabled - True to disable, false to enable.
 */
function toggleSetupControls(disabled) {
    groupList.style.pointerEvents = disabled ? 'none' : 'auto';
    groupList.style.opacity = disabled ? 0.6 : 1;
    gameList.style.pointerEvents = disabled ? 'none' : 'auto';
    gameList.style.opacity = disabled ? 0.6 : 1;
    categoryListContainer.style.pointerEvents = disabled ? 'none' : 'auto';
    categoryListContainer.style.opacity = disabled ? 0.6 : 1;
    document.getElementById('shuffle-questions').disabled = disabled;
}

/**
 * Selects the group and game list items based on the loaded saved game state.
 */
function applySavedStateSelections() {
    const savedStateJSON = localStorage.getItem('animalGameState');
    if (!savedStateJSON) return;

    try {
        const savedState = JSON.parse(savedStateJSON);
        if (!savedState) return;

        // Since we don't know the category of the saved game, we can't select it.
        // We will just load all games to ensure the saved game appears in the list.
        populateGameList(null);
        // And select the "All" category.
        categoryListContainer.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
        categoryListContainer.querySelector('[data-category-id="all"]').classList.add('selected');

        // Select Number of Groups
        const numberOfGroups = savedState.teams.length;
        [...groupList.children].forEach(li => {
            li.classList.toggle('selected', parseInt(li.textContent, 10) === numberOfGroups);
        });

        // Select Game - This needs a delay to ensure populateGameList has finished
        setTimeout(() => {
            const documentId = savedState.options.documentId;
            [...gameList.children].forEach(li => {
                li.classList.toggle('selected', li.dataset.documentId === documentId);
            });
            updateQuestionStats();
        }, 500); // A small delay should be sufficient

    } catch(e) {
        console.error("Could not parse saved state to apply selections:", e);
    }
}

/**
 * Checks for a saved game state and updates the "Continue" checkbox accordingly.
 * This should be called each time the setup screen is shown.
 */
export async function refreshSetupScreenState() {
    const continueCheckbox = document.getElementById('continue-last-point');
    const continueLabel = document.querySelector('label[for="continue-last-point"]');
    const savedStateJSON = localStorage.getItem('animalGameState');

    if (savedStateJSON) {
        try {
            const savedState = JSON.parse(savedStateJSON);
            continueCheckbox.disabled = false;
            continueLabel.textContent = `המשך "${savedState.gameName}"`;
        } catch (e) {
            continueCheckbox.disabled = true;
            continueLabel.textContent = 'המשך מנקודה אחרונה';
            localStorage.removeItem('animalGameState');
        }
    } else {
        continueCheckbox.disabled = true;
        continueLabel.textContent = 'המשך מנקודה אחרונה';
    }
    
    continueCheckbox.checked = false;
    toggleSetupControls(false);

    // Initial data load
    await renderCategories();
    await populateGameList(null); // Load all games by default
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
    
    continueCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        toggleSetupControls(isChecked);
        if (isChecked) {
            applySavedStateSelections();
        }
        updateQuestionStats(); // Re-check button state
    });

    groupList.addEventListener('click', (e) => {
        handleSelection(groupList, e);
        updateQuestionStats();
    });
    gameList.addEventListener('click', (e) => {
        handleSelection(gameList, e);
        updateQuestionStats();
    });

    startButton.addEventListener('click', () => {
        const actualQuestionsText = document.getElementById('actual-questions-stat').textContent;
        const actualQuestions = parseInt(actualQuestionsText.split(':')[1].trim(), 10) || 0;
        const continueLastPoint = document.getElementById('continue-last-point').checked;

        if (actualQuestions === 0 && !continueLastPoint) {
            alert('לא ניתן להתחיל את המשחק כי מספר השאלות בפועל הוא אפס. אנא בחר מספר קבוצות קטן יותר.');
            return;
        }

        setupScreen.classList.add('hidden');
        
        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const selectedGame = gameList.querySelector('.selected');
        const documentId = selectedGame ? selectedGame.dataset.documentId : '';
        const gameDataString = selectedGame ? selectedGame.dataset.gameData : '{}';

        if (!documentId && !continueLastPoint) {
            alert('לא נבחר משחק. אנא בחר משחק מהרשימה.');
            setupScreen.classList.remove('hidden');
            return;
        }

        const shuffleQuestions = document.getElementById('shuffle-questions').checked;
        
        onStart({ numberOfGroups, documentId, gameDataString, shuffleQuestions, actualQuestions, continueLastPoint });
    });
}