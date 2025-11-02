import { getFileUrl } from './appwriteService.js';

// *** שלום! יש לעדכן כאן את מזהי הקבצים (File IDs) שהעתקת מ-Appwrite ***
const IMAGE_FILE_IDS = {
    START_SCREEN: '6907a5790023434e293c',
    TEAM_OWL: '6907a5a0001f41c62853',
    TEAM_FOX: '6907a34200341b1376eb',
    TEAM_ELEPHANT: '6907a560003e403da517',
    TEAM_FROG: '6907a34e0019ed1bd7f6',
    TEAM_LION: '6907a56d0005c76ac2a0',
    CHEST_OPEN: '6907a59000124db5c410',
    CHEST_BROKEN: '6907a597002ec4e72def',
    CHEST_CLOSED: '6907a581002d5279cb02'
};

// Central repository for all image URLs, now built dynamically from Appwrite.
export const IMAGE_URLS = {
    START_SCREEN: getFileUrl(IMAGE_FILE_IDS.START_SCREEN),
    TEAM_OWL: getFileUrl(IMAGE_FILE_IDS.TEAM_OWL),
    TEAM_FOX: getFileUrl(IMAGE_FILE_IDS.TEAM_FOX),
    TEAM_ELEPHANT: getFileUrl(IMAGE_FILE_IDS.TEAM_ELEPHANT),
    TEAM_FROG: getFileUrl(IMAGE_FILE_IDS.TEAM_FROG),
    TEAM_LION: getFileUrl(IMAGE_FILE_IDS.TEAM_LION),
    CHEST_OPEN: getFileUrl(IMAGE_FILE_IDS.CHEST_OPEN),
    CHEST_BROKEN: getFileUrl(IMAGE_FILE_IDS.CHEST_BROKEN),
    CHEST_CLOSED: getFileUrl(IMAGE_FILE_IDS.CHEST_CLOSED)
};

/**
 * Preloads all critical image assets to prevent loading delays during gameplay.
 * This function creates Image objects in the background, causing the browser
 * to fetch and cache them. It does not block the main thread.
 */
export function preloadGameAssets() {
    console.log('Preloading game assets from Appwrite...');
    Object.values(IMAGE_URLS).forEach(url => {
        // Only try to load if the URL is not an empty string (i.e., not a placeholder)
        if (url) {
            try {
                const img = new Image();
                img.src = url;
            } catch (e) {
                console.warn(`Could not preload image: ${url}`, e);
            }
        }
    });
}