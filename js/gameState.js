// --- Constants ---
const GAME_STATE_KEY = 'animalGameState';

// --- State ---
// This private variable holds the entire state of the game.
let _state = {};

/**
 * Persists the current state to localStorage.
 * This is a private function called by state modifiers.
 */
function _saveState() {
    try {
        localStorage.setItem(GAME_STATE_KEY, JSON.stringify(_state));
    } catch (error) {
        console.error("Failed to save game state:", error);
    }
}

/**
 * Resets the internal state to a default empty state.
 */
function _resetInternalState() {
    _state = {
        teams: [],
        activeTeamIndex: 0,
        currentQuestionNumber: 1,
        loadedQuestions: [],
        finalQuestionData: null,
        gameName: '',
        totalQuestions: 0,
        isQuestionPassed: false,
        options: {},
        gameCode: null,
    };
}


/**
 * Initializes a new game state from scratch.
 * @param {object} options - The setup options from the setup screen.
 * @param {object} gameData - The parsed game data object with questions.
 * @param {Array} teamsMasterData - The array of team names and icons.
 */
export function initializeState(options, gameData, teamsMasterData) {
    _resetInternalState();
    _state.options = options;
    _state.gameName = options.gameName || gameData.game_name;
    _state.loadedQuestions = gameData.questions;
    _state.finalQuestionData = gameData.final_question;

    // Shuffle questions if the option is selected
    if (options.shuffleQuestions) {
        // Fisher-Yates shuffle algorithm
        for (let i = _state.loadedQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [_state.loadedQuestions[i], _state.loadedQuestions[j]] = [_state.loadedQuestions[j], _state.loadedQuestions[i]];
        }
    }

    // Slice the question array to the calculated number of questions for the game.
    if (options.actualQuestions > 0 && options.actualQuestions <= _state.loadedQuestions.length) {
        _state.loadedQuestions = _state.loadedQuestions.slice(0, options.actualQuestions);
    }
    
    _state.totalQuestions = _state.loadedQuestions.length;

    // Generate team objects for the state
    for (let i = 0; i < options.numberOfGroups; i++) {
        const team = teamsMasterData[i % teamsMasterData.length];
        _state.teams.push({
            index: i,
            name: team.name,
            icon: team.icon,
            score: 0
        });
    }

    _saveState(); // Perform initial save
}

/**
 * Loads a game state from a provided state object, typically from localStorage.
 * @param {object} savedState - The state object to load.
 */
export function loadStateFromObject(savedState) {
    _state = savedState;
    // Always reset the 'isQuestionPassed' flag when loading a game to prevent weird states.
    _state.isQuestionPassed = false; 
}


/**
 * Retrieves the saved game state from localStorage without loading it into the active state.
 * Useful for checking if a saved game exists.
 * @returns {object|null} The parsed state object or null if not found/invalid.
 */
export function getSavedState() {
    const savedStateJSON = localStorage.getItem(GAME_STATE_KEY);
    if (savedStateJSON) {
        try {
            return JSON.parse(savedStateJSON);
        } catch (e) {
            console.error("Failed to parse saved game state:", e);
            // Clear corrupted data
            localStorage.removeItem(GAME_STATE_KEY);
            return null;
        }
    }
    return null;
}

/**
 * Clears the game state from memory and localStorage.
 */
export function resetState() {
    _resetInternalState();
    localStorage.removeItem(GAME_STATE_KEY);
}

/**
 * Returns a deep copy of the current state to prevent direct mutation from outside modules.
 * @returns {object} The current game state.
 */
export function getState() {
    return JSON.parse(JSON.stringify(_state));
}

/**
 * Updates the score for a specific team.
 * @param {number} teamIndex - The index of the team.
 * @param {number} amount - The amount to add to the score (can be negative).
 */
export function updateScore(teamIndex, amount) {
    const team = _state.teams.find(t => t.index === teamIndex);
    if (team) {
        team.score += amount;
        _saveState();
    }
}

/**
 * Sets the active team index.
 * @param {number} index - The new active team index.
 */
export function setActiveTeam(index) {
    _state.activeTeamIndex = index;
    _saveState();
}

/**
 * Increments the question number.
 * @returns {number} The new question number.
 */
export function incrementQuestion() {
    _state.currentQuestionNumber++;
    _saveState();
    return _state.currentQuestionNumber;
}

/**
 * Sets the flag indicating if a question has been passed.
 * @param {boolean} value - The new value for the flag.
 */
export function setIsQuestionPassed(value) {
    _state.isQuestionPassed = value;
    _saveState();
}

/**
 * Sets the game code for the current session.
 * @param {number} code - The game code.
 */
export function setGameCode(code) {
    _state.gameCode = code;
    _saveState();
}
