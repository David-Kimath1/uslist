import { pickSongOfTheDay } from "./songs.js";
import { VERSES } from "./verses.js";

// ==================== HELPERS ====================

function daysSinceEpoch() {
    return Math.floor(Date.now() / 86400000);
}

function pickFromArray(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[daysSinceEpoch() % arr.length];
}

function extractSpotifyId(url) {
    if (!url) return null;

    // Matches /track/ID, /album/ID, /playlist/ID
    const m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);

    if (m) return { type: m[1], id: m[2] };

    // Short URL (spotify.link/xxxx) — can't parse client-side, skip
    return null;
}


// ==================== SONG OF THE DAY ====================

function renderSongOfTheDay() {

    const container = document.getElementById("songWidget");
    if (!container) return;

    const url = pickSongOfTheDay();
    const parsed = extractSpotifyId(url);

    if (!parsed) {
        container.innerHTML = `
            <div class="widget-empty">
                <i class="bx bx-music"></i>
                <p>Add songs in <code>js/songs.js</code></p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <iframe
            style="border-radius: 12px"
            src="https://open.spotify.com/embed/${parsed.type}/${parsed.id}?utm_source=generator&theme=0"
            width="100%"
            height="152"
            frameBorder="0"
            allowfullscreen=""
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
        ></iframe>
    `;

}


// ==================== BIBLE VERSE OF THE DAY ====================

async function renderVerseOfTheDay() {

    const container = document.getElementById("verseWidget");
    if (!container) return;

    const ref = pickFromArray(VERSES);

    if (!ref) {
        container.innerHTML = `
            <div class="widget-empty">
                <i class="bx bx-book"></i>
                <p>Add verses in <code>js/verses.js</code></p>
            </div>
        `;
        return;
    }

    // Cache per day in sessionStorage
    const cacheKey = "verse:" + daysSinceEpoch();
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
        try {
            const data = JSON.parse(cached);
            renderVerse(container, data);
            return;
        } catch (e) {}
    }

    container.innerHTML = `
        <div class="widget-loading">
            <i class="bx bx-loader-alt bx-spin"></i>
            <p>Loading today's verse…</p>
        </div>
    `;

    try {

        const res = await fetch(
            "https://bible-api.com/" +
            encodeURIComponent(ref) +
            "?translation=web"
        );

        if (!res.ok) throw new Error("Fetch failed");

        const data = await res.json();

        const payload = {
            text: data.text,
            reference: data.reference,
            translation: data.translation_name || "WEB"
        };

        sessionStorage.setItem(cacheKey, JSON.stringify(payload));
        renderVerse(container, payload);

    } catch (error) {

        console.warn("Verse fetch failed:", error);

        container.innerHTML = `
            <div class="widget-empty">
                <i class="bx bx-book"></i>
                <p>Couldn't load today's verse.</p>
            </div>
        `;

    }

}


function renderVerse(container, data) {

    const cleanText = (data.text || "").trim().replace(/\s+/g, " ");

    container.innerHTML = `
        <blockquote class="verse-text">
            ${escapeHTML(cleanText)}
        </blockquote>
        <footer class="verse-footer">
            <span class="verse-ref">${escapeHTML(data.reference)}</span>
            <span class="verse-translation">${escapeHTML(data.translation)}</span>
        </footer>
    `;

}


function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


// ==================== INIT ====================

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        renderSongOfTheDay();
        renderVerseOfTheDay();
    });
} else {
    renderSongOfTheDay();
    renderVerseOfTheDay();
}
