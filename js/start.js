

import { refreshSetupScreenState } from './setup.js';
import { IMAGE_URLS } from './assets.js';

const startScreen = document.getElementById('start-screen');
const setupScreen = document.getElementById('setup-screen');
const goToSetupBtn = document.getElementById('go-to-setup-btn');
const settingsBtn = document.getElementById('settings-btn');
const startImage = document.getElementById('start-screen-image');

/**
 * Initializes the start screen, handling the transition to the setup screen.
 * @param {function} onGoToSettings - Callback to execute when the settings button is clicked.
 */
export function initializeStartScreen(onGoToSettings) {
    if (!startScreen || !setupScreen || !goToSetupBtn || !settingsBtn) {
        console.error('Start screen elements not found!');
        return;
    }

    // Set the image source dynamically from the central assets file
    if (startImage) {
        startImage.src = IMAGE_URLS.START_SCREEN;
    }

    goToSetupBtn.addEventListener('click', async () => {
        startScreen.classList.add('hidden');
        
        // This function now handles loading categories and games.
        await refreshSetupScreenState();

        setupScreen.classList.remove('hidden');
        document.getElementById('global-home-btn').classList.remove('hidden');

        // Set initial focus on the selected group button for accessibility
        const selectedGroup = setupScreen.querySelector('#group-list li.selected');
        if (selectedGroup) {
            // Use a minimal timeout to ensure the element is visible and focusable
            setTimeout(() => selectedGroup.focus(), 0);
        }
    });

    settingsBtn.addEventListener('click', () => {
        // Instead of an alert, we now call the callback to navigate to the edit screen.
        if (onGoToSettings) {
            onGoToSettings();
        }
    });
}