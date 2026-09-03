/**
 * The one context the app makes its sounds in. Kept for the life of the page
 * rather than made per tap, because a browser allows only so many at once and
 * a busy morning is hundreds of taps.
 */
let audio: AudioContext | null = null;

/**
 * The note that says a write went through: one short beep, high enough to
 * carry over a running mill.
 *
 * Whoever empties Ceste is watching the stack rather than the screen, so the
 * confirmation has to reach them without being looked at (#18); the scanner of
 * #23 sounds this same note on each Cesta it reads, which is why it lives here
 * and not on either screen.
 *
 * Synthesised rather than played from a file: no asset to fetch, nothing to
 * decode, and one sound the whole app agrees on. A device that will not give us
 * audio is no reason to fail an action the app has already recorded — the tiles
 * leaving the screen say the same thing.
 */
export function playConfirmation(): void {
  try {
    audio ??= new AudioContext();
    // A tab that has been in the background has its audio suspended: the tap
    // that brings it back wakes the context rather than going silent.
    void audio.resume();
    const note = audio.createOscillator();
    const level = audio.createGain();
    note.frequency.value = 880;
    note.connect(level);
    level.connect(audio.destination);
    level.gain.setValueAtTime(0.2, audio.currentTime);
    level.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    note.start();
    note.stop(audio.currentTime + 0.18);
  } catch {
    // No audio on this device.
  }
}
