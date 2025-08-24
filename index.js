import { initializeSetupScreen } from './setup.js';
import { startGame, initializeScoreControls, adjustScore, switchToNextTeam } from './game.js';
import { initializePreQuestionScreen } from './preq.js';
import { initializeQuestionScreen, showQuestionScreen } from './question.js';


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
     * Callback for when a question is answered or the timer runs out.
     * @param {boolean} wasCorrect - Indicates if the answer was marked as correct.
     */
    const onQuestionComplete = (wasCorrect) => {
        if (wasCorrect) {
            adjustScore(1);
        }
        switchToNextTeam();
    };

    // Initialize the listeners for all screens and components.
    initializeSetupScreen(onGameStart);
    initializePreQuestionScreen(onNextQuestion);
    initializeQuestionScreen(onQuestionComplete);
    initializeScoreControls();
});
