// IMPORTANT: Fill in your Appwrite project details here!
const AppwriteConfig = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    projectId: '690655370021dba8ada1', // Replace with your Project ID
    databaseId: '69065916001e6cdd8b06',       // Replace with your Database ID
    collectionId: 'animal-data',    // Replace with your Collection ID
    bucketId: '6907a2590030f0e8ed04' // <--- עדכן עם ה-Bucket ID שלך!
};

// --- Appwrite SDK Initialization ---
const { Client, Account, Databases, ID, Query, Storage } = window.Appwrite;

const client = new Client();
client
    .setEndpoint(AppwriteConfig.endpoint)
    .setProject(AppwriteConfig.projectId);

const account = new Account(client);
const database = new Databases(client);
const storage = new Storage(client);

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
    // Both need to be valid URLs. We'll redirect to the current page in both cases.
    // Using origin + pathname creates a cleaner URL and avoids issues with query params or hashes.
    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    account.createOAuth2Session('google', redirectUrl, redirectUrl);
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
 * Fetches all non-deleted game templates from the database for the current user.
 * @returns {Promise<Array<object>>} A list of game documents.
 */
export async function listGames() {
    try {
        const user = await getAccount();
        if (!user) {
            // If no user is logged in, return an empty array.
            return [];
        }

        const response = await database.listDocuments(
            AppwriteConfig.databaseId,
            AppwriteConfig.collectionId,
            [
                Query.equal('is_deleted', false), // Only get games that are not soft-deleted
                Query.equal('ownerId', user.$id), // Only get games owned by the current user
                Query.limit(100) // Appwrite has a default limit of 25, so we increase it
            ]
        );
        return response.documents;
    } catch (error) {
        console.error("Failed to list games:", error);
        return []; // Return an empty array on failure to prevent crashes
    }
}

/**
 * Creates a new game template document in the database.
 * @param {string} gameName - The name of the game.
 * @param {object} gameData - The full game object (questions, final_question).
 * @returns {Promise<object>} The newly created document.
 */
export async function createGame(gameName, gameData) {
    try {
        const user = await getAccount();
        if (!user) {
            throw new Error("User not authenticated");
        }

        return database.createDocument(
            AppwriteConfig.databaseId,
            AppwriteConfig.collectionId,
            ID.unique(),
            {
                game_name: gameName,
                game_data: JSON.stringify(gameData),
                is_deleted: false,
                ownerId: user.$id, // Add the required ownerId
                is_public: false // Add the newly required is_public attribute
            }
        );
    } catch (error) {
        console.error("Error creating new game:", error);
        throw error;
    }
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


// --- Storage Functions ---

/**
 * Constructs a public URL for a file in the Appwrite storage bucket.
 * @param {string} fileId - The ID of the file.
 * @returns {string} The public URL to view the file.
 */
export function getFileUrl(fileId) {
    // If the bucket ID or file ID are placeholders, return an empty string to avoid errors.
    if (!fileId || fileId.startsWith('REPLACE_WITH') || AppwriteConfig.bucketId === 'YOUR_BUCKET_ID') {
        return '';
    }
    // storage.getFileView returns a URL object. We need its string representation.
    return storage.getFileView(AppwriteConfig.bucketId, fileId).href;
}