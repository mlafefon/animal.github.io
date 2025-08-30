// A simple audio player for game sound effects.

const soundEffects = {
    correct: new Audio('https://assets.mixkit.co/active_storage/sfx/952/952-preview.mp3'),
    incorrect: new Audio('https://assets.mixkit.co/active_storage/sfx/946/946-preview.mp3'),
    timerTick: new Audio('https://assets.mixkit.co/active_storage/sfx/1047/1047-preview.mp3'),
    chestOpen: new Audio('https://assets.mixkit.co/active_storage/sfx/598/598-preview.mp3'),
    failure: new Audio('https://assets.mixkit.co/active_storage/sfx/473/473-preview.mp3'),
    winner: new Audio('https://assets.mixkit.co/active_storage/sfx/485/485-preview.mp3'),
    gong: new Audio('https://assets.mixkit.co/active_storage/sfx/109/109-preview.mp3'),
    scoreCount: new Audio('https://assets.mixkit.co/active_storage/sfx/1998/1998-preview.mp3')
};
// Adjust volume for subtlety
soundEffects.correct.volume = 0.5;
soundEffects.incorrect.volume = 0.5;
soundEffects.timerTick.volume = 0.6;
soundEffects.chestOpen.volume = 0.6;
soundEffects.failure.volume = 0.6;
soundEffects.winner.volume = 0.7;
soundEffects.gong.volume = 0.5;
soundEffects.scoreCount.volume = 0.4;
soundEffects.scoreCount.loop = true; // Make it loop for the duration of the count


// Preload sounds to reduce latency on first play.
Object.values(soundEffects).forEach(sound => {
    sound.load();
});

/**
 * Plays a sound effect by its key and returns a Promise that resolves when the sound ends.
 * The browser might block autoplay until the user interacts with the page.
 * This is generally fine as sounds are triggered by user actions (clicks).
 * @param {('correct'|'incorrect'|'timerTick'|'chestOpen'|'failure'|'winner'|'gong'|'scoreCount')} soundKey - The key of the sound to play.
 * @returns {Promise<void>} A promise that resolves when the sound finishes playing.
 */
export function playSound(soundKey) {
    return new Promise((resolve, reject) => {
        const sound = soundEffects[soundKey];
        if (sound) {
            // For looping sounds, we can't wait for 'ended', so we resolve immediately.
            if (sound.loop) {
                sound.currentTime = 0;
                sound.play().catch(error => {
                    console.warn(`Could not play looping sound "${soundKey}":`, error);
                    reject(error);
                });
                resolve();
                return;
            }

            // Function to handle cleanup and resolve the promise
            const onPlayEnd = () => {
                resolve();
            };
            sound.addEventListener('ended', onPlayEnd, { once: true });

            sound.currentTime = 0;
            sound.play().catch(error => {
                console.warn(`Could not play sound "${soundKey}":`, error);
                sound.removeEventListener('ended', onPlayEnd); // Clean up listener on error
                reject(error);
            });
        } else {
            const errorMsg = `Sound key "${soundKey}" not found.`;
            console.error(errorMsg);
            reject(new Error(errorMsg));
        }
    });
}

/**
 * Stops a currently playing sound effect.
 * @param {('correct'|'incorrect'|'timerTick'|'chestOpen'|'failure'|'winner'|'gong'|'scoreCount')} soundKey - The key of the sound to stop.
 */
export function stopSound(soundKey) {
    const sound = soundEffects[soundKey];
    if (sound && !sound.paused) {
        sound.pause();
        sound.currentTime = 0; // Rewind to start for next play
    }
}