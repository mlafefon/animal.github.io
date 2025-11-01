// Appwrite SDK configuration and authentication logic

// --- PLEASE CONFIGURE THESE VALUES ---
const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1'; // e.g., 'https://cloud.appwrite.io/v1'
const APPWRITE_PROJECT_ID = '690655370021dba8ada1'; // Your Appwrite project ID
const DATABASE_ID = '69065916001e6cdd8b06'; // Your Appwrite database ID
const GAMES_COLLECTION_ID = 'animal-data'; // Your Appwrite collection ID for games
// --- END OF CONFIGURATION ---

let Client, Account, Databases, Query, Permission, Role, ID;
let account;
let databases;
let sdk;
let currentUser = null;

export function initAuth() {
    // Destructure Appwrite services after the SDK script has loaded and is available on `window`
    ({ Client, Account, Databases, Query, Permission, Role, ID } = window.Appwrite);

    sdk = new Client();
    sdk
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

    account = new Account(sdk);
    databases = new Databases(sdk);
}

export async function getCurrentUser() {
    try {
        currentUser = await account.get();
        return currentUser;
    } catch (error) {
        currentUser = null;
        throw error;
    }
}

export async function loginWithEmail(email, password) {
    await account.createEmailPasswordSession(email, password);
    return await getCurrentUser();
}

export async function signupWithEmail(email, password) {
    await account.create(ID.unique(), email, password);
    return await loginWithEmail(email, password);
}

export async function loginWithGoogle() {
    account.createOAuth2Session(
        'google',
        `${window.location.origin}`, // Success URL
        `${window.location.origin}`  // Failure URL
    );
    // The page will redirect, so no user is returned here directly.
    // The session is handled on the redirect.
}

export async function logout() {
    await account.deleteSession('current');
    currentUser = null;
}

/**
 * Fetches games from the database.
 * It retrieves all public games and the current user's private games.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of game documents.
 */
export async function getGames() {
    if (!currentUser) await getCurrentUser();
    if (!currentUser) throw new Error("User not logged in.");

    const queries = [
        Query.equal("isDeleted", false),
        Query.or([
            Query.equal("isPublic", true),
            Query.equal("ownerId", currentUser.$id)
        ])
    ];

    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            GAMES_COLLECTION_ID,
            queries
        );
        // Parse the content string into a JSON object for each game
        return response.documents.map(doc => ({
            ...doc,
            content: JSON.parse(doc.content || '{}')
        }));
    } catch (error) {
        console.error("Failed to fetch games:", error);
        throw error;
    }
}


/**
 * Fetches only the games owned by the current user.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of the user's game documents.
 */
export async function getMyGames() {
    if (!currentUser) await getCurrentUser();
    if (!currentUser) throw new Error("User not logged in.");

    const queries = [
        Query.equal("isDeleted", false),
        Query.equal("ownerId", currentUser.$id)
    ];

    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            GAMES_COLLECTION_ID,
            queries
        );
        return response.documents.map(doc => ({
            ...doc,
            content: JSON.parse(doc.content || '{}')
        }));
    } catch (error) {
        console.error("Failed to fetch user's games:", error);
        throw error;
    }
}


/**
 * Creates a new game document in the database.
 * @param {object} gameData - The game data object { game_name, questions, final_question }.
 * @returns {Promise<object>} A promise that resolves to the newly created document.
 */
export async function createGame(gameData) {
    if (!currentUser) await getCurrentUser();
    if (!currentUser) throw new Error("User not logged in.");

    const dataPayload = {
        name: gameData.game_name,
        content: JSON.stringify(gameData),
        ownerId: currentUser.$id,
        isPublic: false,
        isDeleted: false,
    };

    // The user has read/write access to their own documents
    const permissions = [
        Permission.read(Role.user(currentUser.$id)),
        Permission.update(Role.user(currentUser.$id)),
        Permission.delete(Role.user(currentUser.$id)),
    ];

    try {
        return await databases.createDocument(
            DATABASE_ID,
            GAMES_COLLECTION_ID,
            ID.unique(),
            dataPayload,
            permissions
        );
    } catch (error) {
        console.error("Failed to create game:", error);
        throw error;
    }
}

/**
 * Updates an existing game document.
 * @param {string} gameId - The Appwrite document ID of the game.
 * @param {object} gameData - The full game data object.
 * @param {boolean} isPublic - The new public status of the game.
 * @returns {Promise<object>} A promise that resolves to the updated document.
 */
export async function saveGame(gameId, gameData, isPublic) {
    if (!currentUser) await getCurrentUser();
    if (!currentUser) throw new Error("User not logged in.");

    const dataPayload = {
        name: gameData.game_name,
        content: JSON.stringify(gameData),
        isPublic: isPublic,
    };
    
    // Adjust permissions based on public status
    const currentDoc = await databases.getDocument(DATABASE_ID, GAMES_COLLECTION_ID, gameId);
    const currentPermissions = currentDoc.$permissions;
    const publicReadPermission = Permission.read(Role.any());

    let newPermissions = currentPermissions.filter(p => p !== publicReadPermission);

    if(isPublic) {
        newPermissions.push(publicReadPermission);
    }

    try {
        return await databases.updateDocument(
            DATABASE_ID,
            GAMES_COLLECTION_ID,
            gameId,
            dataPayload,
            newPermissions
        );
    } catch (error) {
        console.error("Failed to save game:", error);
        throw error;
    }
}

/**
 * Soft deletes a game by setting its `isDeleted` flag to true.
 * @param {string} gameId - The Appwrite document ID of the game.
 * @returns {Promise<object>} A promise that resolves to the updated (soft-deleted) document.
 */
export async function deleteGame(gameId) {
    if (!currentUser) await getCurrentUser();
    if (!currentUser) throw new Error("User not logged in.");

    const dataPayload = {
        isDeleted: true
    };

    try {
        return await databases.updateDocument(
            DATABASE_ID,
            GAMES_COLLECTION_ID,
            gameId,
            dataPayload
        );
    } catch (error) {
        console.error("Failed to delete game:", error);
        throw error;
    }
}