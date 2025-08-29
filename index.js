

import { initializeStartScreen } from './js/start.js';
import { initializeSetupScreen } from './js/setup.js';
import { startGame, initializeScoreControls, adjustScore, switchToNextTeam } from './js/game.js';
import { initializePreQuestionScreen } from './js/preq.js';
import { initializeQuestionScreen, showQuestionScreen } from './js/question.js';
import { initializeBoxesScreen } from './js/boxes.js';
import { initializeEditGameScreen, showEditScreen } from './js/edit_game.js';
import { initializeFinalRound, showBettingScreen } from './js/final.js';
import { initKeyboardNav } from './js/keyboardNav.js';


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


document.addEventListener('DOMContentLoaded', () => {
    /**
     * Callback function that is passed to the setup module.
     * It's called when the user clicks the "Start" button.
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
     * Callback for when the box selection animation completes.
     * This function ONLY adjusts the score on the screen.
     * @param {number} points - The points awarded from the box.
     */
    const onBoxesScoreAwarded = (points) => {
        // Now handles both positive (victory) and negative (failure) scores.
        adjustScore(points);
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
     * Callback to navigate from the start screen to the edit screen.
     */
    const onGoToSettings = () => {
        document.getElementById('start-screen').classList.add('hidden');
        showEditScreen();
    };

    /**
     * Callback to show the final betting screen.
     */
    const onStartBetting = () => {
        showBettingScreen();
    };

    // Initialize the listeners for all screens and components.
    initializeStartScreen(onGoToSettings);
    initializeSetupScreen(onGameStart);
    initializePreQuestionScreen(onNextQuestion, onStartBetting);
    initializeQuestionScreen(onQuestionComplete);
    initializeBoxesScreen(onBoxesScoreAwarded, onBoxesContinue);
    initializeScoreControls();
    initializeEditGameScreen();
    initializeFinalRound();
    initializeFullscreenControls();
    initKeyboardNav(document.body); // Initialize keyboard navigation for the whole app
});