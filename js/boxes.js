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
import { setBoxesData, getState } from './gameState.js';


/**
 * Dispatches a custom event to signal that the game state has changed
 * and needs to be broadcast to participants.
 */
function notifyStateChange() {
    document.dispatchEvent(new CustomEvent('gamestatechange'));
}


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
 * Handles the selection of a treasure chest.
 * @param {Event} event - The click event from the chest.
 */
async function handleChestClick(event) {
    const currentState = getState();
    if (chestSelected || (currentState.boxesData && currentState.boxesData.selectedChestIndex !== null)) {
        return; // Prevent multiple selections
    }
    chestSelected = true;

    const selectedChest = event.currentTarget;
    const score = parseInt(selectedChest.dataset.score, 10);
    const chestIndex = Array.from(treasureChests).indexOf(selectedChest);

    // Update state to show the selection and broadcast to participants
    const newBoxesData = { ...currentState.boxesData, selectedChestIndex: chestIndex };
    setBoxesData(newBoxesData);
    notifyStateChange();

    // This function will be called once the score animation finishes.
    const showReturnButton = () => {
        returnBtn.classList.add('visible');
        // We use a nested setTimeout with a 0ms delay. This pushes the focus() call
        // to the end of the browser's event queue, ensuring it runs *after* the
        // browser has processed the style changes from adding the '.visible' class.
        // This makes the element focusable just before we try to focus it.
        setTimeout(() => {
            returnBtn.focus();
        }, 0);
    };

    // Change image to open chest
    const selectedImg = selectedChest.querySelector('img');
    if (score < 0) {
        selectedImg.src = IMAGE_URLS.CHEST_BROKEN;
    } else {
        selectedImg.src = IMAGE_URLS.CHEST_OPEN;
    }
    selectedImg.style.transform = 'scale(1.1)';

    // Mark the selected chest and disable others
    selectedChest.classList.add('selected');
    treasureChests.forEach(chest => {
        // Hide chest number
        chest.querySelector('span').style.display = 'none';

        // Reveal the score above the chest
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'score-reveal-above';
        // Use Left-to-Right Mark (LRM) character to ensure minus sign is on the left in RTL.
        scoreDiv.textContent = `\u200e${chest.dataset.score}`;
        chest.appendChild(scoreDiv);

        if (chest !== selectedChest) {
            chest.classList.add('disabled');
        } else {
            scoreDiv.classList.add('selected-score');
        }
    });

    // Use LRM character for the message as well.
    boxesMessage.textContent = `הניקוד שהתקבל: \u200e${score} נקודות`;

    // Play sound and then trigger score animation. The timing depends on the outcome.
    if (score < 0) {
        // For failure, wait for the failure sound to end before starting the score animation.
        await playSound('failure');
        if (onBoxesCompleteCallback) {
            onBoxesCompleteCallback(score, showReturnButton);
        }
    } else {
        // For victory, play the sound and start the score animation after a fixed delay.
        playSound('chestOpen');
        const soundDelay = 1500;
        setTimeout(() => {
            if (onBoxesCompleteCallback) {
                onBoxesCompleteCallback(score, showReturnButton);
            }
        }, soundDelay);
    }
}

/**
 * Programmatically triggers a click on a specific chest, used for participant selections.
 * @param {number} chestIndex The index of the chest to click (0, 1, or 2).
 */
export function triggerChestSelection(chestIndex) {
    if (chestIndex >= 0 && chestIndex < treasureChests.length) {
        const chestToClick = treasureChests[chestIndex];
        if (chestToClick && !chestToClick.classList.contains('disabled')) {
            chestToClick.click();
        }
    }
}

/**
 * Shows the boxes screen, assigns pre-determined random scores, and hides the game screen.
 * @param {object} options - Configuration for the boxes screen.
 * @param {string} [options.mode='victory'] - The mode, can be 'victory', 'failure', or 'half-victory'.
 */
export function showBoxesScreen(options = {}) {
    const { mode = 'victory' } = options;
    resetBoxesScreen();
    
    let scores;
    let title;

    if (mode === 'failure') {
        title = 'תיבת כישלון (0 עד 25-)';
        scores = [0, -5, -10, -15, -20, -25];
    } else if (mode === 'half-victory') {
        title = 'חצי תיבת נצחון (5-25)';
        scores = [5, 10, 15, 20, 25];
    } else { // Default to 'victory'
        title = 'תיבת נצחון (10-50)';
        scores = [10, 20, 30, 40, 50];
    }
    
    boxesTitle.textContent = title;
    
    shuffleArray(scores);
    treasureChests.forEach((chest, index) => {
        // Only assign score, don't show it yet
        chest.dataset.score = scores[index % scores.length];
    });
    
    document.getElementById('game-screen').classList.add('hidden');
    boxesScreen.classList.remove('hidden');
    
    // Update game state for participants and broadcast it
    const boxesData = {
        mode,
        scores,
        selectedChestIndex: null
    };
    setBoxesData(boxesData);
    notifyStateChange();
}

/**
 * Initializes listeners for the boxes screen.
 * @param {function} onComplete - Callback function that receives the awarded score to update the UI.
 * @param {function} onContinue - Callback function to continue to the next turn.
 */
export function initializeBoxesScreen(onComplete, onContinue) {
    onBoxesCompleteCallback = onComplete;
    onBoxesContinueCallback = onContinue;

    treasureChests.forEach(chest => {
        chest.setAttribute('role', 'button');
        chest.setAttribute('tabindex', '0');
        chest.addEventListener('click', handleChestClick);
    });

    returnBtn.addEventListener('click', () => {
        // This button is now the only way to proceed from this screen.
        if (onBoxesContinueCallback) {
            onBoxesContinueCallback();
        }
    });
}