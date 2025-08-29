// A simple audio player for game sound effects.

const soundEffects = {
    correct: new Audio('https://assets.mixkit.co/active_storage/sfx/952/952-preview.mp3'),
    incorrect: new Audio('https://assets.mixkit.co/active_storage/sfx/946/946-preview.mp3'),
    timerTick: new Audio('https://assets.mixkit.co/active_storage/sfx/1047/1047-preview.mp3'),
    chestOpen: new Audio('https://assets.mixkit.co/active_storage/sfx/598/598-preview.mp3'),
    failure: new Audio('https://assets.mixkit.co/active_storage/sfx/473/473-preview.mp3'),
    winner: new Audio('https://assets.mixkit.co/active_storage/sfx/485/485-preview.mp3')
};
// Adjust volume for subtlety
soundEffects.correct.volume = 0.5;
soundEffects.incorrect.volume = 0.5;
soundEffects.timerTick.volume = 0.3;
soundEffects.chestOpen.volume = 0.6;
soundEffects.failure.volume = 0.6;
soundEffects.winner.volume = 0.7;


// Preload sounds to reduce latency on first play.
Object.values(soundEffects).forEach(sound => {
    sound.load();
});

/**
 * Plays a sound effect by its key.
 * The browser might block autoplay until the user interacts with the page.
 * This is generally fine as sounds are triggered by user actions (clicks).
 * @param {('correct'|'incorrect'|'timerTick'|'chestOpen'|'failure'|'winner')} soundKey - The key of the sound to play.
 */
export function playSound(soundKey) {
    const sound = soundEffects[soundKey];
    if (sound) {
        // Rewind to the start in case it's played again quickly
        sound.currentTime = 0;
        sound.play().catch(error => {
            // Autoplay may be blocked. We can warn in the console but not disrupt the user.
            console.warn(`Could not play sound "${soundKey}":`, error);
        });
    } else {
        console.error(`Sound key "${soundKey}" not found.`);
    }
}

/**
 * Stops a currently playing sound effect.
 * @param {('correct'|'incorrect'|'timerTick'|'chestOpen'|'failure'|'winner')} soundKey - The key of the sound to stop.
 */
export function stopSound(soundKey) {
    const sound = soundEffects[soundKey];
    if (sound && !sound.paused) {
        sound.pause();
        sound.currentTime = 0; // Rewind to start for next play
    }
}