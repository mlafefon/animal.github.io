
import { initializeStartScreen } from './js/start.js';
import { initializeSetupScreen } from './js/setup.js';
import { startGame, initializeScoreControls, adjustScore, switchToNextTeam } from './js/game.js';
import { initializePreQuestionScreen } from './js/preq.js';
import { initializeQuestionScreen, stopTimer } from './js/question.js';
import { initializeBoxesScreen } from './js/boxes.js';
import { initializeEditGameScreen, showEditScreen } from './js/edit_game.js';
import { initializeFinalRound, showBettingScreen } from './js/final.js';
import { initKeyboardNav } from './js/keyboardNav.js';
import { preloadGameAssets } from './js/assets.js';
import {
    initAuth,
    getCurrentUser,
    loginWithEmail,
    loginWithGoogle,
    signupWithEmail,
    logout
} from './js/auth.js';

// --- Screen Elements ---
const authScreen = document.getElementById('auth-screen');
const startScreen = document.getElementById('start-screen');
const allScreens = [
    document.getElementById('setup-screen'),
    document.getElementById('pre-question-screen'),
    document.getElementById('game-screen'),
    document.getElementById('boxes-screen'),
    document.getElementById('betting-screen'),
    document.getElementById('final-question-screen'),
    document.getElementById('edit-game-screen'),
];
const gameFooter = document.getElementById('main-game-footer');


/**
 * Initializes controls related to fullscreen mode.
 */
function initializeFullscreenControls() {
    const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');
    if (!fullscreenToggleBtn) return;

    const enterIcon = document.getElementById('fullscreen-enter-icon');
    const exitIcon = document.getElementById('fullscreen-exit-icon');

    fullscreenToggleBtn.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    const updateIcon = () => {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        enterIcon.classList.toggle('hidden', isFullscreen);
        exitIcon.classList.toggle('hidden', !isFullscreen);
    };

    document.addEventListener('fullscreenchange', updateIcon);
    document.addEventListener('webkitfullscreenchange', updateIcon);

    updateIcon();
}

/**
 * Initializes the global home button.
 */
function initializeGlobalHomeButton() {
    const homeBtn = document.getElementById('global-home-btn');
    if (!homeBtn) return;

    homeBtn.addEventListener('click', () => {
        stopTimer();
        allScreens.forEach(screen => screen.classList.add('hidden'));
        gameFooter.classList.remove('visible');
        document.body.classList.remove('game-active');
        homeBtn.classList.add('hidden');
        authScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
    });
}

function showApp(user) {
    authScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    if (user) {
        userName.textContent = user.name || user.email;
        userInfo.classList.remove('hidden');
    }
}

function showAuthScreen() {
    startScreen.classList.add('hidden');
    allScreens.forEach(s => s.classList.add('hidden'));
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('global-home-btn').classList.add('hidden');
    authScreen.classList.remove('hidden');
}


function initializeAuthListeners() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginEmailBtn = document.getElementById('login-email-btn');
    const signupEmailBtn = document.getElementById('signup-email-btn');
    const loginGoogleBtn = document.getElementById('login-google-btn');
    const authError = document.getElementById('auth-error');

    const handleAuthAction = async (action) => {
        const email = emailInput.value;
        const password = passwordInput.value;
        authError.classList.add('hidden');
        try {
            const user = await action(email, password);
            if (user) showApp(user);
        } catch (error) {
            console.error(error);
            authError.textContent = error.message || 'An unknown error occurred.';
            authError.classList.remove('hidden');
        }
    };
    
    loginEmailBtn.addEventListener('click', () => handleAuthAction(loginWithEmail));
    signupEmailBtn.addEventListener('click', () => handleAuthAction(signupWithEmail));
    loginGoogleBtn.addEventListener('click', () => handleAuthAction(loginWithGoogle));
}


window.addEventListener('load', async () => {
    preloadGameAssets();
    initAuth();
    initializeAuthListeners();

    const onGameStart = (options) => {
        startGame(options);
    };
    const onNextQuestion = (startTime) => {
        showQuestionScreen(startTime);
    };
    const onQuestionComplete = () => {};
    const onBoxesScoreAwarded = (points, onAnimationComplete) => {
        adjustScore(points, onAnimationComplete);
    };
    const onBoxesContinue = () => {
        document.getElementById('boxes-screen').classList.add('hidden');
        switchToNextTeam();
    };
    const onGoToSettings = () => {
        document.getElementById('start-screen').classList.add('hidden');
        showEditScreen();
    };
    const onStartBetting = () => {
        showBettingScreen();
    };
    const onLogout = async () => {
        try {
            await logout();
            showAuthScreen();
        } catch (error) {
            console.error("Logout failed:", error);
            alert("Logout failed. Please try again.");
        }
    };

    initializeStartScreen(onGoToSettings, onLogout);
    initializeSetupScreen(onGameStart);
    initializePreQuestionScreen(onNextQuestion, onStartBetting);
    initializeQuestionScreen(onQuestionComplete);
    initializeBoxesScreen(onBoxesScoreAwarded, onBoxesContinue);
    initializeScoreControls();
    initializeEditGameScreen();
    initializeFinalRound();
    initializeFullscreenControls();
    initializeGlobalHomeButton();
    initKeyboardNav(document.body);

    // Initial auth check
    try {
        const user = await getCurrentUser();
        showApp(user);
    } catch (error) {
        showAuthScreen();
    }
});
