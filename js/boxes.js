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
import { setBoxesState, updateSelectedChest, clearBoxesState } from './gameState.js';


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
 * Handles the logic for revealing a selected chest, updating state, and playing animations.
 * This can be triggered by the host's click or a participant's action.
 * @param {number} chestIndex The index (0-2) of the chest to reveal.
 */
export async function revealChest(chestIndex) {
    if (chestSelected) return;
    chestSelected = true;

    const selectedChest = treasureChests[chestIndex];
    if (!selectedChest) return;
    
    const score = parseInt(selectedChest.dataset.score, 10);

    // Update global state and dispatch event for broadcasting
    updateSelectedChest(chestIndex, score);
    document.dispatchEvent(new Event('gamestatechange'));

    // This function will be called once the score animation finishes.
    const showReturnButton = () => {
        returnBtn.classList.add('visible');
        setTimeout(() => {
            returnBtn.focus();
        }, 0);
    };

    // --- Visual reveal logic ---
    const selectedImg = selectedChest.querySelector('img');
    if (score < 0) {
        selectedImg.src = IMAGE_URLS.CHEST_BROKEN;
    } else {
        selectedImg.src = IMAGE_URLS.CHEST_OPEN;
    }
    selectedImg.style.transform = 'scale(1.1)';

    selectedChest.classList.add('selected');
    treasureChests.forEach((chest, index) => {
        chest.querySelector('span').style.display = 'none';
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'score-reveal-above';
        scoreDiv.textContent = `\u200e${chest.dataset.score}`;
        chest.appendChild(scoreDiv);

        if (index !== chestIndex) {
            chest.classList.add('disabled');
        } else {
            scoreDiv.classList.add('selected-score');
        }
    });
    
    boxesMessage.textContent = `הניקוד שהתקבל: \u200e${score} נקודות`;

    // --- Sound and score animation logic ---
    if (score < 0) {
        await playSound('failure');
        if (onBoxesCompleteCallback) {
            onBoxesCompleteCallback(score, showReturnButton);
        }
    } else {
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
        chest.dataset.score = scores[index % scores.length];
    });

    // Update global state and dispatch an event to broadcast it
    setBoxesState(scores, mode);
    document.dispatchEvent(new Event('gamestatechange'));

    document.getElementById('game-screen').classList.add('hidden');
    boxesScreen.classList.remove('hidden');
}

/**
 * Initializes listeners for the boxes screen.
 * @param {function} onComplete - Callback function that receives the awarded score to update the UI.
 * @param {function} onContinue - Callback function to continue to the next turn.
 */
export function initializeBoxesScreen(onComplete, onContinue) {
    onBoxesCompleteCallback = onComplete;
    onBoxesContinueCallback = onContinue;

    treasureChests.forEach((chest, index) => {
        chest.setAttribute('role', 'button');
        chest.setAttribute('tabindex', '0');
        chest.addEventListener('click', () => revealChest(index));
    });

    returnBtn.addEventListener('click', () => {
        clearBoxesState(); // Update state first
        if (onBoxesContinueCallback) {
            onBoxesContinueCallback(); // This will trigger the next turn and broadcast
        }
    });
}