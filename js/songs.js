// ==================== SONGS OF THE DAY ====================

export const SONGS = [
    "https://open.spotify.com/track/5XSuj4xrbakbDeSQom3oAr",
    "https://open.spotify.com/track/5L1QmczrLlB7Fd5b3P19Mz",
    "https://open.spotify.com/track/77DPPsj43UAUoncZaJ5478",
    "https://open.spotify.com/track/682LDjkqYYZS3nggYDEtAs",
];


// ==================== PICKER ====================

// Returns a song URL for today.
// "Random per day" — same song all day, new one at midnight.
// Uses a hash of (today's date) so both partners see the same song.
export function pickSongOfTheDay() {

    if (!SONGS.length) return null;

    // Fixed seed per day: days since 2020-01-01
    const dayNumber = Math.floor(Date.now() / 86400000);

    // Simple hash to scramble: multiply by a large prime, mod length
    const index = (dayNumber * 2654435761) % SONGS.length;

    return SONGS[Math.abs(index)];

}
