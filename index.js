



import { initializeStartScreen } from './js/start.js';
import { initializeSetupScreen } from './js/setup.js';
import { startGame, initializeScoreControls, adjustScore, switchToNextTeam } from './js/game.js';
import { initializePreQuestionScreen } from './js/preq.js';
import { initializeQuestionScreen, showQuestionScreen } from './js/question.js';
import { initializeBoxesScreen } from './js/boxes.js';
import { initializeEditGameScreen, showEditScreen } from './js/edit_game.js';


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
     * Callback for when a question is answered incorrectly or the timer runs out.
     */
    const onQuestionComplete = () => {
        switchToNextTeam();
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
        // Whether they got points or not, switch to the next team.
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

    // Initialize the listeners for all screens and components.
    initializeStartScreen(onGoToSettings);
    initializeSetupScreen(onGameStart);
    initializePreQuestionScreen(onNextQuestion);
    initializeQuestionScreen(onQuestionComplete);
    initializeBoxesScreen(onBoxesScoreAwarded, onBoxesContinue);
    initializeScoreControls();
    initializeEditGameScreen();
});