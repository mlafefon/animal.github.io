

const startScreen = document.getElementById('start-screen');
const setupScreen = document.getElementById('setup-screen');
const goToSetupBtn = document.getElementById('go-to-setup-btn');
const settingsBtn = document.getElementById('settings-btn');
const startImage = document.getElementById('start-screen-image');

// Centralizing the image URL here makes it easier to change in the future.
const START_IMAGE_URL = 'https://cdn.pixabay.com/photo/2015/12/18/13/46/tiger-1098607_1280.jpg';

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

    goToSetupBtn.addEventListener('click', () => {
        startScreen.classList.add('hidden');
        setupScreen.classList.remove('hidden');
    });

    settingsBtn.addEventListener('click', () => {
        // Instead of an alert, we now call the callback to navigate to the edit screen.
        if (onGoToSettings) {
            onGoToSettings();
        }
    });
}
