// A simple audio player for game sound effects.

const soundEffects = {
    correct: new Audio('sound/correct.mp3'),
    incorrect: new Audio('https://actions.google.com/sounds/v1/negative/failure.ogg'),
    timerTick: new Audio('sound/timerTick.mp3'),
    chestOpen: new Audio('https://actions.google.com/sounds/v1/magical/magic_chime.ogg')
};

// Adjust volume for subtlety
soundEffects.correct.volume = 0.5;
soundEffects.incorrect.volume = 0.5;
soundEffects.timerTick.volume = 0.3;
soundEffects.chestOpen.volume = 0.6;


// Preload sounds to reduce latency on first play.
Object.values(soundEffects).forEach(sound => {
    sound.load();
});

/**
 * Plays a sound effect by its key.
 * The browser might block autoplay until the user interacts with the page.
 * This is generally fine as sounds are triggered by user actions (clicks).
 * @param {('correct'|'incorrect'|'timerTick'|'chestOpen')} soundKey - The key of the sound to play.
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
