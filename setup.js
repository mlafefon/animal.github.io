const groupList = document.getElementById('group-list');
const gameList = document.getElementById('game-list');
const startButton = document.getElementById('start-btn');
const setupScreen = document.getElementById('setup-screen');

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
 * Initializes the setup screen by attaching event listeners.
 * @param {function} onStart - The callback function to execute when the start button is clicked.
 */
export function initializeSetupScreen(onStart) {
    groupList.addEventListener('click', (e) => handleSelection(groupList, e));
    gameList.addEventListener('click', (e) => handleSelection(gameList, e));

    startButton.addEventListener('click', () => {
        setupScreen.classList.add('hidden');
        
        const selectedGroup = groupList.querySelector('.selected');
        const numberOfGroups = selectedGroup ? parseInt(selectedGroup.textContent, 10) : 4;
        
        const selectedGame = gameList.querySelector('.selected');
        const gameName = selectedGame ? selectedGame.textContent : 'הגנת סייבר';

        // Call the provided callback with the selected options
        onStart({ numberOfGroups, gameName });
    });
}
