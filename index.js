

import { initializeStartScreen } from './js/start.js';
import { initializeSetupScreen, showSetupScreenForGame } from './js/setup.js';
import { startGame, initializeScoreControls, adjustScore, switchToNextTeam } from './js/game.js';
import { initializePreQuestionScreen } from './js/preq.js';
import { initializeQuestionScreen, showQuestionScreen, stopTimer } from './js/question.js';
import { initializeBoxesScreen } from './js/boxes.js';
import { initializeEditGameScreen, showEditScreen, checkForUnsavedChangesAndProceed } from './js/edit_game.js';
import { initializeFinalRound, showBettingScreen } from './js/final.js';
import { initKeyboardNav } from './js/keyboardNav.js';
import { preloadGameAssets } from './js/assets.js';
import { initializeAuth } from './js/auth.js';
import { clearAllCaches, logout, getAccount, unsubscribeAllRealtime } from './js/appwriteService.js';
import { initializeConfirmModal, initializeLinkModal, showNotification, initializeQuestionPreviewModal, initializeNotification } from './js/ui.js';
import { getState } from './js/gameState.js';


/**
 * Initializes controls related to fullscreen mode.
 */
function initializeFullscreenControls() {
    const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');
    if (!fullscreenToggleBtn) return;

    const enterIcon = document.getElementById('fullscreen-enter-icon');
    const exitIcon = document.getElementById('fullscreen-exit-icon');

    // --- Toggle Fullscreen ---
    fullscreenToggleBtn.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { /* Safari */
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { /* IE11 */
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        }
    });

    // --- Listen for Fullscreen Changes to Update Icon ---
    const updateIcon = () => {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        enterIcon.classList.toggle('hidden', isFullscreen);
        exitIcon.classList.toggle('hidden', !isFullscreen);
    };

    document.addEventListener('fullscreenchange', updateIcon);
    document.addEventListener('webkitfullscreenchange', updateIcon); // Safari support

    updateIcon(); // Set initial icon state
}


/**
 * Initializes the global home button to be available on all screens.
 * It uses the new confirmation flow to check for unsaved changes before returning home.
 */
function initializeGlobalHomeButton() {
    const homeBtn = document.getElementById('global-home-btn');
    if (!homeBtn) return;

    homeBtn.addEventListener('click', () => {
        const goHome = () => {
            stopTimer(); // Stop any active game timer
            unsubscribeAllRealtime(); // Unsubscribe from Appwrite channels

            // Hide all potential screens
            const allScreens = [
                document.getElementById('setup-screen'),
                document.getElementById('join-host-screen'),
                document.getElementById('pre-question-screen'),
                document.getElementById('game-screen'),
                document.getElementById('boxes-screen'),
                document.getElementById('betting-screen'),
                document.getElementById('final-question-screen'),
                document.getElementById('edit-game-screen'),
            ];
            allScreens.forEach(screen => screen.classList.add('hidden'));
            
            // Reset main layout state
            document.getElementById('main-game-footer').classList.remove('visible');
            document.body.classList.remove('game-active');
            homeBtn.classList.add('hidden');

            // Show the main start screen and header
            document.getElementById('start-screen').classList.remove('hidden');
            document.getElementById('global-header').classList.remove('hidden');
        };

        checkForUnsavedChangesAndProceed(goHome);
    });
}


/**
 * Initializes the global logout button, integrating the unsaved changes check.
 */
function initializeGlobalLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', () => {
        const performLogout = async () => {
            try {
                await logout();
                window.location.reload(); // Easiest way to reset all state
            } catch (error) {
                console.error('Logout Failed:', error);
                showNotification('ההתנתקות נכשלה.', 'error');
            }
        };

        checkForUnsavedChangesAndProceed(performLogout);
    });
}


/**
 * A central function to show the main application view (edit screen) after authentication.
 * @param {object} user - The authenticated user object from Appwrite.
 */
function showMainApp(user) {
    document.getElementById('global-header').classList.remove('hidden');
    const userGreeting = document.getElementById('user-greeting');
    if (user && userGreeting) {
        const displayName = user.name || user.email;
        userGreeting.textContent = `${displayName}`;
    }
    showEditScreen();
}


/**
 * Encapsulates the initialization of all core application modules.
 * This function is called only after a user has been successfully authenticated.
 */
export function initializeApp() {
     // Preload all critical assets as soon as the DOM is ready to prevent UI lag.
    preloadGameAssets();

    /**
     * Callback function that is passed to the setup module.
     * It's called when the user clicks the "Start" button on the simplified setup screen.
     * @param {object} options - The game options selected by the user.
     */
    const onGameStart = (options) => {
        startGame(options);
    };

    /**
     * Callback for when the "Next Question" button is clicked on the pre-question screen.
     * @param {number} startTime - The time for the question timer.
     */
    const onNextQuestion = (startTime) => {
        showQuestionScreen(startTime);
    };

    /**
     * Callback for when a question is answered and a box is chosen.
     * This signals that the active team's turn is over.
     */
    const onQuestionComplete = () => {
        // This function is now called *before* showing the boxes screen.
        // It signals that the current team has finished their answer attempt.
        // The actual switch to the next team will happen after the box is selected.
    };

    /**
     * Callback for when a box is selected and its value should be awarded.
     * This function triggers the score adjustment and animation.
     * @param {number} points - The points awarded from the box.
     * @param {function} [onAnimationComplete] - An optional callback to run after the score animation finishes.
     */
    const onBoxesScoreAwarded = (points, onAnimationComplete) => {
        // Adjusts the score and passes the completion callback to the animation logic.
        adjustScore(points, onAnimationComplete);
    };

    /**
     * Callback for when the user clicks "Return" on the boxes screen to continue.
     */
    const onBoxesContinue = () => {
        // This is now the single point where we advance to the next team's turn.
        document.getElementById('boxes-screen').classList.add('hidden');
        switchToNextTeam();
    };

    /**
     * New callback for the "Start" button. It checks for authentication and routes the user.
     */
    const onStartClick = async () => {
        const startScreen = document.getElementById('start-screen');
        const authScreen = document.getElementById('auth-screen');
        try {
            const user = await getAccount();
            // User is logged in, go to the main app (edit screen).
            startScreen.classList.add('hidden');
            showMainApp(user);
        } catch (error) {
            // User is not logged in, go to the authentication screen.
            startScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
        }
    };
    
    /**
     * Callback for when a user successfully logs in.
     */
    const onLoginSuccess = async () => {
        const authScreen = document.getElementById('auth-screen');
        authScreen.classList.add('hidden');
        try {
            const user = await getAccount();
            showMainApp(user);
        } catch (error) {
            // Should not happen, but as a fallback, go to start.
            document.getElementById('start-screen').classList.remove('hidden');
        }
    };

    /**
     * Callback to show the final betting screen.
     */
    const onStartBetting = () => {
        showBettingScreen();
    };

    // Initialize the listeners for all screens and components.
    initializeStartScreen(onStartClick);
    initializeSetupScreen(onGameStart);
    initializePreQuestionScreen(onNextQuestion, onStartBetting);
    initializeQuestionScreen(onQuestionComplete);
    initializeBoxesScreen(onBoxesScoreAwarded, onBoxesContinue);
    initializeScoreControls();
    initializeEditGameScreen(onGameStart);
    initializeFinalRound();
    initializeFullscreenControls();
    initializeGlobalHomeButton();
    initializeGlobalLogoutButton();
    initializeConfirmModal();
    initializeLinkModal();
    initializeQuestionPreviewModal();
    initializeNotification();
    initKeyboardNav(document.body); // Initialize keyboard navigation for the whole app
    initializeAuth(onLoginSuccess);
}


document.addEventListener('DOMContentLoaded', () => {
    // On every page refresh, clear the session cache to get the latest data.
    clearAllCaches();
    unsubscribeAllRealtime(); // Ensure no lingering subscriptions on reload
    
    // Initialize all application logic and event listeners.
    initializeApp();

    // Set the initial view: always show the start screen.
    // All other screens are hidden by default in the HTML, so this is enough.
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('global-header').classList.add('hidden');

    // Fetch and display the app version
    fetch('metadata.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const version = data.version;
            if (version) {
                const startScreen = document.getElementById('start-screen');
                const versionElement = document.createElement('p');
                versionElement.className = 'app-version';
                versionElement.textContent = `גרסה ${version}`;
                startScreen.appendChild(versionElement);
            }
        })
        .catch(error => console.error('Error fetching app version:', error));
});
