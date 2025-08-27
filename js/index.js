import { initializeSetupScreen } from './setup.js';
import { startGame, initializeScoreControls, adjustScore, switchToNextTeam } from './game.js';
import { initializePreQuestionScreen } from './preq.js';
import { initializeQuestionScreen, showQuestionScreen } from './question.js';
import { initializeBoxesScreen } from './boxes.js';


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
     * Callback for when the user selects a victory box (or returns).
     * @param {number} points - The points awarded from the box.
     */
    const onBoxesComplete = (points) => {
        if (points > 0) {
            adjustScore(points);
        }
        // Whether they got points or not, switch to the next team.
        document.getElementById('boxes-screen').classList.add('hidden');
        switchToNextTeam();
    };

    // Initialize the listeners for all screens and components.
    initializeSetupScreen(onGameStart);
    initializePreQuestionScreen(onNextQuestion);
    initializeQuestionScreen(onQuestionComplete);
    initializeBoxesScreen(onBoxesComplete);
    initializeScoreControls();
});