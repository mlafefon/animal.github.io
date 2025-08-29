

import { populateGameList, refreshSetupScreenState } from './setup.js';

const startScreen = document.getElementById('start-screen');
const setupScreen = document.getElementById('setup-screen');
const goToSetupBtn = document.getElementById('go-to-setup-btn');
const settingsBtn = document.getElementById('settings-btn');
const startImage = document.getElementById('start-screen-image');

// Centralizing the image URL here makes it easier to change in the future.
const START_IMAGE_URL = 'https://drive.google.com/thumbnail?id=17M-mnVL1Ifm-H2umz6dSiVux5WD_e7Mh';

/**
 * Initializes the start screen, handling the transition to the setup screen.
 * @param {function} onGoToSettings - Callback to execute when the settings button is clicked.
 */
export function initializeStartScreen(onGoToSettings) {
    if (!startScreen || !setupScreen || !goToSetupBtn || !settingsBtn) {
        console.error('Start screen elements not found!');
        return;
    }

    // Set the image source dynamically
    if (startImage) {
        startImage.src = START_IMAGE_URL;
    }

    goToSetupBtn.addEventListener('click', async () => {
        startScreen.classList.add('hidden');
        
        // Refresh the game list every time before showing the setup screen
        await populateGameList();

        // Refresh the 'Continue' checkbox state every time as well
        refreshSetupScreenState();

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
