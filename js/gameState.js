
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
        sessionDocumentId: null, // To store the Appwrite document ID
        gameStateForParticipant: 'waiting', // The high-level state for participant view
        boxesData: null, // To hold scores and selection for the boxes screen
        timerEndTime: null, // To sync timers with participants
    };
}


/**
 * Initializes a new game state from scratch.
 * @param {object} options - The setup options from the setup screen.
 * @param {object} gameData - The parsed game data object with questions.
 * @param {Array} teamsMasterData - The array of team names and icons.
 */
export function initializeState(options, gameData, teamsMasterData) {
    // Check if the current state in memory is from a setup phase for this game.
    // If so, preserve the team selections made by participants.
    const setupTeams = (_state.gameCode === options.gameCode) ? _state.teams : [];

    _resetInternalState();
    _state.options = options;
    _state.gameName = options.gameName || gameData.game_name;
    _state.loadedQuestions = gameData.questions;
    _state.finalQuestionData = gameData.final_question;
    _state.gameCode = options.gameCode;
    _state.sessionDocumentId = options.sessionDocumentId;

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
        const teamMaster = teamsMasterData[i % teamsMasterData.length];
        const existingTeam = setupTeams.find(t => t.index === i);

        _state.teams.push({
            index: i,
            name: teamMaster.name,
            icon: teamMaster.icon,
            iconKey: teamMaster.iconKey,
            score: 0,
            isTaken: existingTeam ? existingTeam.isTaken : false,
            participantId: existingTeam ? existingTeam.participantId : null
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
 * Sets the entire teams array. Used by host to update 'isTaken' status.
 * @param {Array<object>} teamsArray - The new teams array.
 */
export function setTeams(teamsArray) {
    _state.teams = teamsArray;
    // Don't save to localStorage during setup phase, only during active game
    if (_state.gameStateForParticipant !== 'setup') {
        _saveState();
    }
}

/**
 * Unassigns a participant from a team.
 * @param {number} teamIndex The index of the team to free up.
 * @returns {string|null} The ID of the participant who was kicked, or null.
 */
export function unassignParticipant(teamIndex) {
    const team = _state.teams.find(t => t.index === teamIndex);
    if (team && team.isTaken) {
        const participantId = team.participantId;
        team.isTaken = false;
        team.participantId = null;
        // This is a transient setup state change, no need to save to localStorage.
        return participantId;
    }
    return null;
}

/**
 * Initializes a minimal state for the pre-game setup phase (join screen).
 * This state is NOT saved to localStorage as it's transient.
 * @param {string} gameName The name of the game.
 * @param {string} gameCode The 6-digit join code.
 * @param {string} sessionDocumentId The Appwrite document ID for the session.
 * @param {Array<object>} teams The initial array of team objects.
 */
export function initializeSetupState(gameName, gameCode, sessionDocumentId, teams) {
    _resetInternalState(); // Clear any previous game state
    _state.gameName = gameName;
    _state.gameCode = gameCode;
    _state.sessionDocumentId = sessionDocumentId;
    _state.teams = teams;
    _state.gameStateForParticipant = 'setup';
    // We don't call _saveState() here because this state is temporary
    // until the game officially starts. The official start will save it.
}

/**
 * Clears session-specific details (code, documentId, participant data) from the state.
 * This is used when the host backs out of a session that participants have joined,
 * forcing a new session to be created on the next attempt.
 */
export function clearSessionDetails() {
    _state.gameCode = null;
    _state.sessionDocumentId = null;
    if (_state.teams) {
        _state.teams.forEach(team => {
            team.isTaken = false;
            team.participantId = null;
        });
    }
    // This state is transient and shouldn't be saved to localStorage.
    // It's a temporary state before a new session is created.
}

/**
 * Sets the state for the boxes screen.
 * @param {Array<number>} scores The shuffled scores for the boxes.
 * @param {string} mode The type of box ('victory', 'failure', etc.).
 */
export function setBoxesState(scores, mode) {
    _state.gameStateForParticipant = 'boxes';
    _state.boxesData = {
        scores: scores,
        mode: mode,
        selectedIndex: null,
        selectedScore: null
    };
    _saveState();
}

/**
 * Updates the state after a chest has been selected.
 * @param {number} index The index of the selected chest.
 * @param {number} score The score value of the selected chest.
 */
export function updateSelectedChest(index, score) {
    if (_state.boxesData) {
        _state.boxesData.selectedIndex = index;
        _state.boxesData.selectedScore = score;
        _state.gameStateForParticipant = 'boxes-revealed';
        _saveState();
    }
}

/**
 * Clears the boxes data from the state when leaving the screen.
 */
export function clearBoxesState() {
    _state.boxesData = null;
    _state.gameStateForParticipant = 'waiting'; // Or whatever the next state should be
    _saveState();
}

/**
 * Sets the high-level state for the participant view (e.g., 'waiting', 'question', 'grading').
 * @param {string} newState The new state for participants.
 */
export function setParticipantState(newState) {
    _state.gameStateForParticipant = newState;
    _saveState();
}

/**
 * Sets the timestamp for when the current question's timer should end.
 * This is transient and not saved to localStorage.
 * @param {number|null} timestamp The future timestamp in milliseconds, or null to clear.
 */
export function setTimerEndTime(timestamp) {
    _state.timerEndTime = timestamp;
}
