// IMPORTANT: Fill in your Appwrite project details here!
const AppwriteConfig = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    projectId: '690655370021dba8ada1', // Replace with your Project ID
    databaseId: '69065916001e6cdd8b06',       // Replace with your Database ID
    collectionId: 'animal-data'    // Replace with your Collection ID
};

// --- Appwrite SDK Initialization ---
const { Client, Account, Databases, ID, Query } = window.Appwrite;

const client = new Client();
client
    .setEndpoint(AppwriteConfig.endpoint)
    .setProject(AppwriteConfig.projectId);

const account = new Account(client);
const database = new Databases(client);

// --- Authentication Functions ---

/**
 * Logs in a user with email and password.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<object>} The user session object.
 */
export function login(email, password) {
    return account.createEmailSession(email, password);
}

/**
 * Initiates OAuth2 login with Google.
 */
export function loginWithGoogle() {
    // The second argument is the success URL, the third is failure.
    // An empty string for success will redirect back to the current page.
    account.createOAuth2Session('google', window.location.href, '');
}

/**
 * Logs out the current user.
 * @returns {Promise} A promise that resolves on successful logout.
 */
export function logout() {
    return account.deleteSession('current');
}

/**
 * Retrieves the currently logged-in user's account details.
 * @returns {Promise<object|null>} The user account object or null if not logged in.
 */
export function getAccount() {
    return account.get();
}


// --- Database (Game Templates) Functions ---

/**
 * Fetches all non-deleted game templates from the database.
 * @returns {Promise<Array<object>>} A list of game documents.
 */
export async function listGames() {
    try {
        const response = await database.listDocuments(
            AppwriteConfig.databaseId,
            AppwriteConfig.collectionId,
            [
                Query.equal('is_deleted', false), // Only get games that are not soft-deleted
                Query.limit(100) // Appwrite has a default limit of 25, so we increase it
            ]
        );
        return response.documents;
    } catch (error) {
        console.error("Failed to list games:", error);
        throw error;
    }
}

/**
 * Creates a new game template document in the database.
 * @param {string} gameName - The name of the game.
 * @param {object} gameData - The full game object (questions, final_question).
 * @returns {Promise<object>} The newly created document.
 */
export function createGame(gameName, gameData) {
     return database.createDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.collectionId,
        ID.unique(),
        {
            game_name: gameName,
            game_data: JSON.stringify(gameData), // Store the game data as a JSON string
            is_deleted: false
        }
    );
}

/**
 * Updates an existing game template document.
 * @param {string} documentId - The ID of the document to update.
 * @param {string} gameName - The updated name of the game.
 * @param {object} gameData - The updated full game object.
 * @returns {Promise<object>} The updated document.
 */
export function updateGame(documentId, gameName, gameData) {
    return database.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.collectionId,
        documentId,
        {
            game_name: gameName,
            game_data: JSON.stringify(gameData)
        }
    );
}

/**
 * Performs a "soft delete" on a game template by setting its `is_deleted` flag to true.
 * @param {string} documentId - The ID of the document to soft delete.
 * @returns {Promise<object>} The updated document.
 */
export function deleteGame(documentId) {
    return database.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.collectionId,
        documentId,
        {
            is_deleted: true
        }
    );
}
