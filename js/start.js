import { refreshSetupScreenState } from './setup.js';
import { IMAGE_URLS } from './assets.js';

const startScreen = document.getElementById('start-screen');
const setupScreen = document.getElementById('setup-screen');
const goToSetupBtn = document.getElementById('go-to-setup-btn');
const startImage = document.getElementById('start-screen-image');

/**
 * Initializes the start screen, handling the transition to the setup screen.
 * @param {function} onGoToSettings - Callback to execute when the settings button is clicked.
 */
export function initializeStartScreen(onGoToSettings) {
    if (!startScreen || !setupScreen || !goToSetupBtn) {
        console.error('Start screen elements not found!');
        return;
    }

    // Set the image source dynamically from the central assets file
    if (startImage) {
        startImage.src = IMAGE_URLS.START_SCREEN;
    }

    goToSetupBtn.addEventListener('click', () => {
        // This button now behaves identically to the settings button, taking the user
        // to the new game selection/editing hub.
        if (onGoToSettings) {
            onGoToSettings();
        }
    });
}