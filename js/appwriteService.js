// IMPORTANT: Fill in your Appwrite project details here!
const AppwriteConfig = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    projectId: '690655370021dba8ada1', // Replace with your Project ID
    databaseId: '69065916001e6cdd8b06',       // Replace with your Database ID
    collectionId: 'animal-data',    // Replace with your Collection ID
    bucketId: '6907a2590030f0e8ed04' // <--- עדכן עם ה-Bucket ID שלך!
};

// --- Appwrite SDK Initialization ---
const { Client, Account, Databases, ID, Query, Storage, Permission, Role } = window.Appwrite;

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


// --- Caching Helper Functions ---

/**
 * Clears all game-related caches from session storage.
 * This should be called after any mutation (create, update, delete) to game data,
 * and on page load to ensure fresh data.
 */
export function clearAllCaches() {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('gamesCache_') || key === 'categoriesCache')) {
            sessionStorage.removeItem(key);
        }
    }
}


// --- Database (Game Templates) Functions ---

/**
 * Fetches all category documents from the database, using a session cache.
 * @returns {Promise<Array<object>>} A list of category documents.
 */
export async function listCategories() {
    const cacheKey = 'categoriesCache';
    try {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        const response = await database.listDocuments(
            AppwriteConfig.databaseId,
            'categories', // The collection for categories
            [Query.limit(50)]
        );
        
        sessionStorage.setItem(cacheKey, JSON.stringify(response.documents));
        return response.documents;
    } catch (error) {
        console.error("Failed to list categories:", error);
        return [];
    }
}


/**
 * Fetches the user's own games PLUS any public games from other users.
 * The resulting list includes an `isOwned` flag on each document.
 * @param {string|null} categoryId - The ID of the category to filter by. If null, returns all games.
 * @returns {Promise<Array<object>>} A merged and sorted list of game documents.
 */
export async function listGames(categoryId = null) {
    const cacheKey = categoryId ? `gamesCache_${categoryId}` : 'gamesCache_all';
    try {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        const user = await getAccount();
        if (!user) {
            return [];
        }

        // --- Query 1: User's own games (not deleted) ---
        const myGamesQueries = [
            Query.equal('ownerId', user.$id),
            Query.equal('is_deleted', false),
            Query.limit(100)
        ];
        if (categoryId) {
            myGamesQueries.push(Query.equal('categoryId', categoryId));
        }

        // --- Query 2: Public games from anyone (not deleted) ---
        const publicGamesQueries = [
            Query.equal('is_public', true),
            Query.equal('is_deleted', false),
            Query.limit(100)
        ];
        if (categoryId) {
            publicGamesQueries.push(Query.equal('categoryId', categoryId));
        }

        // --- Fetch both sets of games in parallel ---
        const [myGamesResponse, publicGamesResponse] = await Promise.all([
            database.listDocuments(AppwriteConfig.databaseId, AppwriteConfig.collectionId, myGamesQueries),
            database.listDocuments(AppwriteConfig.databaseId, AppwriteConfig.collectionId, publicGamesQueries)
        ]);

        // --- Merge and de-duplicate results ---
        const allGamesMap = new Map();

        // Add user's own games first and mark them as owned.
        myGamesResponse.documents.forEach(doc => {
            doc.isOwned = true;
            allGamesMap.set(doc.$id, doc);
        });

        // Add public games, but don't overwrite if it's the user's own game.
        publicGamesResponse.documents.forEach(doc => {
            if (!allGamesMap.has(doc.$id)) {
                doc.isOwned = false;
                allGamesMap.set(doc.$id, doc);
            }
        });
        
        const finalGames = Array.from(allGamesMap.values());
        
        // Sort the list to show owned games first, then by name.
        finalGames.sort((a, b) => {
            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;
            return a.game_name.localeCompare(b.game_name);
        });
        
        sessionStorage.setItem(cacheKey, JSON.stringify(finalGames));
        return finalGames;

    } catch (error) {
        console.error("Failed to list games:", error);
        return [];
    }
}


/**
 * Creates a new game template document in the database and invalidates the cache.
 * @param {string} gameName - The name of the game.
 * @param {string} description - The game's description.
 * @param {string} categoryId - The document ID of the game's category.
 * @param {object} gameData - The full game object (questions, final_question).
 * @param {boolean} isPublic - Whether the game should be publicly readable.
 * @returns {Promise<object>} The newly created document.
 */
export async function createGame(gameName, description, categoryId, gameData, isPublic) {
    try {
        const user = await getAccount();
        if (!user) {
            throw new Error("User not authenticated");
        }

        const permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
        ];

        if (isPublic) {
            permissions.push(Permission.read(Role.users()));
        }

        const newDocument = await database.createDocument(
            AppwriteConfig.databaseId,
            AppwriteConfig.collectionId,
            ID.unique(),
            {
                game_name: gameName,
                description: description,
                categoryId: categoryId,
                game_data: JSON.stringify(gameData),
                is_deleted: false,
                ownerId: user.$id,
                is_public: isPublic
            },
            permissions
        );

        clearAllCaches(); // Invalidate cache after successful creation
        return newDocument;

    } catch (error) {
        console.error("Error creating new game:", error);
        throw error;
    }
}


/**
 * Updates an existing game template document and invalidates the cache.
 * @param {string} documentId - The ID of the document to update.
 * @param {string} gameName - The updated name of the game.
 * @param {string} description - The updated description of the game.
 * @param {string} categoryId - The updated category document ID for the game.
 * @param {object} gameData - The updated full game object.
 * @param {boolean} isPublic - The updated public status of the game.
 * @returns {Promise<object>} The updated document.
 */
export async function updateGame(documentId, gameName, description, categoryId, gameData, isPublic) {
    const user = await getAccount();
    if (!user) {
        throw new Error("User not authenticated for update");
    }

    const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
    ];

    if (isPublic) {
        permissions.push(Permission.read(Role.users()));
    }

    const updatedDocument = await database.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.collectionId,
        documentId,
        {
            game_name: gameName,
            description: description,
            categoryId: categoryId,
            game_data: JSON.stringify(gameData),
            is_public: isPublic
        },
        permissions
    );
    clearAllCaches(); // Invalidate cache after successful update
    return updatedDocument;
}

/**
 * Performs a "soft delete" on a game template and invalidates the cache.
 * @param {string} documentId - The ID of the document to soft delete.
 * @returns {Promise<object>} The updated document.
 */
export async function deleteGame(documentId) {
    const updatedDocument = await database.updateDocument(
        AppwriteConfig.databaseId,
        AppwriteConfig.collectionId,
        documentId,
        {
            is_deleted: true
        }
    );
    clearAllCaches(); // Invalidate cache after successful delete
    return updatedDocument;
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