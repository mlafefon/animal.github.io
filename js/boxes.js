// --- Elements ---
const boxesScreen = document.getElementById('boxes-screen');
const chestsContainer = document.getElementById('chests-container');
const returnBtn = document.getElementById('return-from-boxes-btn');
const boxesMessage = document.getElementById('boxes-message');
const treasureChests = document.querySelectorAll('.treasure-chest');
const boxesTitle = document.getElementById('boxes-title');

// --- State ---
let onBoxesCompleteCallback = null;
let onBoxesContinueCallback = null;
let chestSelected = false;

import { IMAGE_URLS } from './assets.js';
import { playSound } from './audio.js';
import * as gameState from './gameState.js';


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
    returnBtn.classList.remove('visible'); // Hide the button when resetting
    treasureChests.forEach((chest) => {
        chest.classList.remove('selected', 'disabled');
        chest.removeAttribute('data-score'); // Clear previous score
        
        chest.querySelector('.score-reveal-above')?.remove();
        
        const img = chest.querySelector('img');
        img.src = IMAGE_URLS.CHEST_CLOSED;
        img.style.transform = 'scale(1)';
        img.style.display = 'block';

        chest.querySelector('span').style.display = 'block';
    });
}

/**
 * Handles the logic for revealing all chests after one has been selected.
 * @param {HTMLElement} selectedChest The chest element that was chosen.
 */
async function revealAllChests(selectedChest) {
    const score = parseInt(selectedChest.dataset.score, 10);

    const showReturnButton = () => {
        returnBtn.classList.add('visible');
        setTimeout(() => {
            returnBtn.focus();
        }, 0);
    };

    const selectedImg = selectedChest.querySelector('img');
    if (score < 0) {
        selectedImg.src = IMAGE_URLS.CHEST_BROKEN;
    } else {
        selectedImg.src = IMAGE_URLS.CHEST_OPEN;
    }
    selectedImg.style.transform = 'scale(1.1)';

    selectedChest.classList.add('selected');
    treasureChests.forEach(chest => {
        chest.querySelector('span').style.display = 'none';
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'score-reveal-above';
        scoreDiv.textContent = `\u200e${chest.dataset.score}`;
        chest.appendChild(scoreDiv);

        if (chest !== selectedChest) {
            chest.classList.add('disabled');
        } else {
            scoreDiv.classList.add('selected-score');
        }
    });

    boxesMessage.textContent = `הניקוד שהתקבל: \u200e${score} נקודות`;

    if (score < 0) {
        await playSound('failure');
        if (onBoxesCompleteCallback) {
            onBoxesCompleteCallback(score, showReturnButton);
        }
    } else {
        playSound('chestOpen');
        setTimeout(() => {
            if (onBoxesCompleteCallback) {
                onBoxesCompleteCallback(score, showReturnButton);
            }
        }, 1500);
    }
}


/**
 * Shows the boxes screen, assigns pre-determined random scores, and hides the game screen.
 * @param {object} options - Configuration for the boxes screen.
 * @param {string} [options.mode='victory'] - The mode, can be 'victory', 'failure', 'half-victory', or 'waiting'.
 * @param {string} [options.victoryType] - The type of victory if mode is 'waiting'.
 */
export function showBoxesScreen(options = {}) {
    const { mode = 'victory', victoryType } = options;
    resetBoxesScreen();
    
    let scores;
    let title;

    if (mode === 'waiting') {
        title = victoryType === 'half-victory' ? 'חצי תיבת נצחון (5-25)' : 'תיבת נצחון (10-50)';
        boxesTitle.textContent = title;
        boxesMessage.textContent = 'ממתינים לבחירת תיבה מהנייד...';
        chestsContainer.style.display = 'flex';
        treasureChests.forEach(chest => {
            chest.classList.add('disabled'); // Make them look non-interactive
        });
    } else { // 'failure' mode, which is still initiated by the host
        title = 'תיבת כישלון (0 עד 25-)';
        scores = [0, -5, -10, -15, -20, -25];
        boxesTitle.textContent = title;
        shuffleArray(scores);
        treasureChests.forEach((chest, index) => {
            chest.dataset.score = scores[index % scores.length];
        });
        chestsContainer.style.display = 'flex';
    }
    
    document.getElementById('game-screen').classList.add('hidden');
    boxesScreen.classList.remove('hidden');
}


/**
 * Called when a participant selects a box. This triggers the reveal animation on the host screen.
 * @param {number} boxIndex - The index (1, 2, or 3) of the chosen box.
 */
export function revealSelectedBox(boxIndex) {
    if (chestSelected) return;

    const { boxScores } = gameState.getState();
    if (!boxScores || boxScores.length < 3) {
        console.error("Box scores not found for reveal.");
        return;
    }

    treasureChests.forEach((chest, index) => {
        chest.dataset.score = boxScores[index];
    });

    const selectedChest = chestsContainer.querySelector(`[data-chest="${boxIndex}"]`);
    if (!selectedChest) {
        console.error(`Chest with index ${boxIndex} not found.`);
        return;
    }
    
    chestSelected = true;
    revealAllChests(selectedChest);
}

/**
 * Initializes listeners for the boxes screen.
 * @param {function} onComplete - Callback function that receives the awarded score to update the UI.
 * @param {function} onContinue - Callback function to continue to the next turn.
 */
export function initializeBoxesScreen(onComplete, onContinue) {
    onBoxesCompleteCallback = onComplete;
    onBoxesContinueCallback = onContinue;

    // This listener is now only for the 'failure' mode, which is the only time the host clicks a box.
    chestsContainer.addEventListener('click', async (event) => {
        const selectedChest = event.currentTarget.closest('.treasure-chest');
        // Only proceed if a chest was clicked, it's not disabled, and one hasn't been selected yet.
        if (selectedChest && !selectedChest.classList.contains('disabled') && !chestSelected) {
             chestSelected = true;
             await revealAllChests(selectedChest);
        }
    });

    returnBtn.addEventListener('click', () => {
        if (onBoxesContinueCallback) {
            onBoxesContinueCallback();
        }
    });
}