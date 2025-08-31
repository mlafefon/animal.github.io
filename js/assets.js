// Central repository for all image URLs, used for preloading and single-source-of-truth.

export const IMAGE_URLS = {
    START_SCREEN: 'https://drive.google.com/thumbnail?id=17M-mnVL1Ifm-H2umz6dSiVux5WD_e7Mh',
    TEAM_OWL: 'https://drive.google.com/thumbnail?id=1tARCfOYPOljZ5EFgovdaiUxUXwHqJZ7I',
    TEAM_FOX: 'https://drive.google.com/thumbnail?id=1z7HUg1rUjt6MjiycsPxpoyTY9BWvxWgS',
    TEAM_ELEPHANT: 'https://drive.google.com/thumbnail?id=1hXwW9zfOVdlnEI-P3O9f8AdkvAJV0ljr',
    TEAM_FROG: 'https://drive.google.com/thumbnail?id=1owX2_Qo51yF1Mtk7xbxzg7aF1oHY-E4L',
    TEAM_LION: 'https://drive.google.com/thumbnail?id=1GBWmsUQ46_AdL_w_-T6lnsE5hNlR5twb',
    CHEST_OPEN: 'https://drive.google.com/thumbnail?id=1tHAZ7bNSJv6GNi1lFXEcY6HrIU7fQRZa',
    CHEST_BROKEN: 'https://drive.google.com/thumbnail?id=1zmhK3PApQnzyFj2VLkANftxStwryp-hD',
    CHEST_CLOSED: 'https://drive.google.com/thumbnail?id=1rSOXo048hHdRLX4MWypmdsUWDQkyKipL'
};

/**
 * Preloads all critical image assets to prevent loading delays during gameplay.
 * This function creates Image objects in the background, causing the browser
 * to fetch and cache them. It does not block the main thread.
 */
export function preloadGameAssets() {
    console.log('Preloading game assets...');
    Object.values(IMAGE_URLS).forEach(url => {
        try {
            const img = new Image();
            img.src = url;
        } catch (e) {
            console.warn(`Could not preload image: ${url}`, e);
        }
    });
}
