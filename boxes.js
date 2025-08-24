// --- Elements ---
const boxesScreen = document.getElementById('boxes-screen');
const chestsContainer = document.getElementById('chests-container');
const returnBtn = document.getElementById('return-from-boxes-btn');
const boxesMessage = document.getElementById('boxes-message');
const treasureChests = document.querySelectorAll('.treasure-chest');

let onBoxesCompleteCallback = null;
let chestSelected = false;

/**
 * Shuffles an array in place (Fisher-Yates algorithm).
 * @param {Array} array The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Resets the state of the boxes screen for a new turn.
 */
function resetBoxesScreen() {
    chestSelected = false;
    boxesMessage.textContent = 'יש לבחור תיבה';
    treasureChests.forEach(chest => {
        chest.classList.remove('selected', 'disabled');
        chest.removeAttribute('data-score'); // Clear previous score
        const scoreDisplay = chest.querySelector('.score-reveal');
        if (scoreDisplay) {
            scoreDisplay.remove();
        }
        chest.querySelector('span').style.display = 'block';
        chest.querySelector('img').style.display = 'block';
    });
}

/**
 * Handles the selection of a treasure chest.
 * @param {Event} event - The click event from the chest.
 */
function handleChestClick(event) {
    if (chestSelected) return;
    chestSelected = true;

    const selectedChest = event.currentTarget;
    const score = parseInt(selectedChest.dataset.score, 10);
    
    // Mark the selected chest and disable others
    selectedChest.classList.add('selected');
    treasureChests.forEach(chest => {
        if (chest !== selectedChest) {
            chest.classList.add('disabled');
        }
    });

    // Reveal the score
    boxesMessage.textContent = `זכית ב-${score} נקודות!`;
    const scoreReveal = document.createElement('div');
    scoreReveal.className = 'score-reveal';
    scoreReveal.textContent = score;
    selectedChest.querySelector('img').style.display = 'none';
    selectedChest.querySelector('span').style.display = 'none';
    selectedChest.appendChild(scoreReveal);


    // Wait a moment, then call the callback to proceed
    setTimeout(() => {
        if (onBoxesCompleteCallback) {
            onBoxesCompleteCallback(score);
        }
    }, 2500); // 2.5 seconds delay
}

/**
 * Shows the boxes screen, assigns pre-determined random scores, and hides the game screen.
 */
export function showBoxesScreen() {
    resetBoxesScreen();
    
    // Define possible scores, shuffle them, and assign to chests
    const scores = [10, 20, 30, 40, 50];
    shuffleArray(scores);
    treasureChests.forEach((chest, index) => {
        chest.dataset.score = scores[index];
    });

    document.getElementById('game-screen').classList.add('hidden');
    boxesScreen.classList.remove('hidden');
}

/**
 * Initializes listeners for the boxes screen.
 * @param {function} onComplete - Callback function that receives the awarded score.
 */
export function initializeBoxesScreen(onComplete) {
    onBoxesCompleteCallback = onComplete;

    treasureChests.forEach(chest => {
        chest.addEventListener('click', handleChestClick);
    });

    returnBtn.addEventListener('click', () => {
        // Forfeits the points and moves to the next turn if no chest was selected
        if (!chestSelected && onBoxesCompleteCallback) {
            onBoxesCompleteCallback(0); 
        }
    });
}
