import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ==================== STATE ====================

let currentUser = null;
let coupleId = null;
let coupleData = null;

let allItems = [];
let allMemories = [];
let allDates = [];

let cards = [];
let currentCard = 0;

let selectedYear = new Date().getFullYear();


// ==================== ELEMENTS ====================

const yearSelect = document.getElementById("recapYear");
const storyEl = document.getElementById("recapStory");
const cardEl = document.getElementById("recapCard");
const progressEl = document.getElementById("recapProgress");
const prevBtn = document.getElementById("recapPrev");
const nextBtn = document.getElementById("recapNext");
const emptyEl = document.getElementById("recapEmpty");
const emptyTextEl = document.getElementById("recapEmptyText");


// ==================== CATEGORY THEMES ====================

const CATEGORY_THEMES = {
    romance: {
        gradient: "linear-gradient(150deg, #7a3045 0%, #a55268 55%, #c28a9c 100%)",
        unsplash: "romance,sunset,love",
        icon: "bx-heart"
    },
    travel: {
        gradient: "linear-gradient(150deg, #2d5a63 0%, #4a8290 55%, #7aa8b3 100%)",
        unsplash: "beach,coast,ocean",
        icon: "bx-map"
    },
    adventure: {
        gradient: "linear-gradient(150deg, #7a4f2a 0%, #a87145 55%, #c99e70 100%)",
        unsplash: "mountains,adventure,hiking",
        icon: "bx-run"
    },
    memories: {
        gradient: "linear-gradient(150deg, #4a3a63 0%, #6a5a8a 55%, #9286ad 100%)",
        unsplash: "warm,nostalgia,soft",
        icon: "bx-camera"
    },
    goals: {
        gradient: "linear-gradient(150deg, #3f5a3f 0%, #5f845f 55%, #8fb08f 100%)",
        unsplash: "sunrise,achievement,success",
        icon: "bx-target-lock"
    },
    food: {
        gradient: "linear-gradient(150deg, #7a4a2a 0%, #a87050 55%, #d1a080 100%)",
        unsplash: "food,cozy,dinner",
        icon: "bx-restaurant"
    },
    default: {
        gradient: "linear-gradient(150deg, #703f49 0%, #92535f 55%, #b47780 100%)",
        unsplash: "warm,soft,texture",
        icon: "bx-heart"
    }
};

function getTheme(category) {
    if (!category) return CATEGORY_THEMES.default;
    const key = String(category).toLowerCase().trim();
    return CATEGORY_THEMES[key] || CATEGORY_THEMES.default;
}


// ==================== BOOTSTRAP ====================

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    coupleId = userData.coupleId;

    const coupleSnap = await getDoc(doc(db, "couples", coupleId));
    if (coupleSnap.exists()) {
        coupleData = coupleSnap.data();
    }

    // Show story immediately — no loading state
    storyEl.hidden = false;

    try {
        await loadAllData();
        buildYearOptions();
        render();
    } catch (error) {
        console.error("Recap load failed:", error);
        storyEl.hidden = true;
        emptyEl.hidden = false;
        emptyTextEl.textContent =
            "Could not load your recap. Check the console for details.";
    }

});


// ==================== LOAD DATA ====================

async function loadAllData() {

    const itemsRef = collection(db, "couples", coupleId, "items");

    const sharedSnap = await getDocs(
        query(itemsRef, where("visibility", "==", "shared"))
    );

    const privateSnap = await getDocs(
        query(
            itemsRef,
            where("visibility", "==", "private"),
            where("createdBy", "==", currentUser.uid)
        )
    );

    const merged = [
        ...sharedSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        ...privateSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    ];

    const seen = new Set();
    allItems = merged.filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
    });


    const memoriesSnap = await getDocs(
        collection(db, "couples", coupleId, "memories")
    );
    allMemories = memoriesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data()
    }));


    const datesSnap = await getDocs(
        collection(db, "couples", coupleId, "dates")
    );
    allDates = datesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data()
    }));

}


// ==================== YEAR SELECT ====================

function buildYearOptions() {

    const now = new Date().getFullYear();
    const years = new Set([now]);

    allItems.forEach((i) => {
        const y = tsYear(i.createdAt);
        if (y) years.add(y);
    });

    allMemories.forEach((m) => {
        const y = tsYear(m.createdAt);
        if (y) years.add(y);
    });

    allDates.forEach((d) => {
        const y = tsYear(d.createdAt);
        if (y) years.add(y);
    });

    const sorted = [...years].sort((a, b) => b - a);

    yearSelect.innerHTML = "";
    sorted.forEach((y) => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        if (y === selectedYear) opt.selected = true;
        yearSelect.appendChild(opt);
    });

    yearSelect.addEventListener("change", () => {
        selectedYear = parseInt(yearSelect.value, 10);
        render();
    });

}


// ==================== BUILD CARDS ====================

function buildCards() {

    const result = [];

    const yearItems = allItems.filter(
        (i) => tsYear(i.createdAt) === selectedYear
    );

    const yearCompleted = yearItems.filter((i) => i.completed);

    const yearMemories = allMemories.filter(
        (m) => tsYear(m.createdAt) === selectedYear
    );

    const yearDates = allDates.filter(
        (d) => tsYear(d.createdAt) === selectedYear
    );


    // ---------- Welcome ----------
    result.push({
        theme: "welcome",
        category: null,
        eyebrow: "YOUR YEAR",
        title: `Your ${selectedYear} in UsList`,
        subtitle:
            yearItems.length + yearMemories.length + yearDates.length === 0
                ? "This year is still a blank page."
                : "Here's what you wrote together."
    });


    // ---------- Total adventures ----------
    if (yearItems.length > 0) {
        result.push({
            theme: "items",
            category: null,
            eyebrow: "BUCKET LIST",
            big: yearItems.length,
            title: yearItems.length === 1
                ? "adventure added"
                : "adventures added",
            subtitle:
                yearItems.length === 1
                    ? "You started with one big dream."
                    : "You dreamed up quite a few things."
        });
    }


    // ---------- Completed ----------
    if (yearCompleted.length > 0) {

        const percentage = Math.round(
            (yearCompleted.length / yearItems.length) * 100
        );

        result.push({
            theme: "completed",
            category: null,
            eyebrow: "COMPLETED",
            big: yearCompleted.length,
            title: percentage === 100
                ? "— all of them"
                : `of ${yearItems.length}`,
            subtitle: percentage === 100
                ? "You finished everything you started. Incredible."
                : `That's ${percentage}% of your list.`
        });

        const mostRecent = [...yearCompleted].sort((a, b) =>
            tsSeconds(b.completedAt) - tsSeconds(a.completedAt)
        )[0];

        if (mostRecent) {
            result.push({
                theme: "highlight",
                category: mostRecent.category,
                eyebrow: "THE LAST ONE",
                title: mostRecent.title,
                subtitle: mostRecent.description || "A moment worth remembering."
            });
        }
    }


    // ---------- Memories as photo cards ----------
    if (yearMemories.length > 0) {

        result.push({
            theme: "memories",
            category: null,
            eyebrow: "MEMORIES",
            big: yearMemories.length,
            title: yearMemories.length === 1
                ? "memory saved"
                : "memories saved",
            subtitle: "Little moments you chose to keep forever."
        });

        const recent = [...yearMemories]
            .sort((a, b) => tsSeconds(b.createdAt) - tsSeconds(a.createdAt))
            .slice(0, 3);

        recent.forEach((m) => {

            const dishGuess = extractDishName(m.title);

            result.push({
                theme: "memory-photo",
                category: m.category || "memories",
                eyebrow: "A MOMENT",
                title: m.title,
                subtitle: m.description || "",
                date: m.date,
                dishName: dishGuess
            });

        });

    }


    // ---------- Dates ----------
    if (yearDates.length > 0) {
        result.push({
            theme: "dates",
            category: null,
            eyebrow: "IMPORTANT DAYS",
            big: yearDates.length,
            title: yearDates.length === 1
                ? "date marked"
                : "dates marked",
            subtitle: "Days you didn't want to forget."
        });
    }


    // ---------- Top category ----------
    const catCounts = {};
    yearItems.forEach((i) => {
        const c = i.category || "Other";
        catCounts[c] = (catCounts[c] || 0) + 1;
    });

    const topCat = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])[0];

    if (topCat && topCat[1] > 0) {
        result.push({
            theme: "top-category",
            category: topCat[0],
            eyebrow: "YOUR FAVOURITE",
            big: topCat[0],
            title: `${topCat[1]} ${topCat[1] === 1 ? "item" : "items"}`,
            subtitle: "Your most-visited category this year."
        });
    }


    // ---------- Most productive month ----------
    const monthCounts = {};
    yearCompleted.forEach((i) => {
        const m = tsMonth(i.completedAt || i.createdAt);
        if (m !== null) monthCounts[m] = (monthCounts[m] || 0) + 1;
    });

    const topMonth = Object.entries(monthCounts)
        .sort((a, b) => b[1] - a[1])[0];

    if (topMonth && topMonth[1] > 0) {
        const monthName = new Date(
            selectedYear,
            parseInt(topMonth[0], 10),
            1
        ).toLocaleDateString(undefined, { month: "long" });

        result.push({
            theme: "top-month",
            category: null,
            eyebrow: "MOST PRODUCTIVE",
            big: monthName,
            title: `${topMonth[1]} completed`,
            subtitle: "Your busiest month together."
        });
    }


    // ---------- Days together ----------
    if (coupleData?.createdAt) {
        const days = Math.max(
            1,
            Math.round(
                (Date.now() - tsSeconds(coupleData.createdAt) * 1000) /
                (86400000)
            )
        );

        result.push({
            theme: "days",
            category: null,
            eyebrow: "TOGETHER",
            big: days,
            title: days === 1 ? "day" : "days",
            subtitle: "Since you connected on UsList."
        });
    }


    // ---------- Closing ----------
    result.push({
        theme: "closing",
        category: null,
        eyebrow: "THAT'S A WRAP",
        title: `Here's to ${selectedYear + 1}`,
        subtitle: "More adventures, more memories, more us."
    });

    return result;

}


// ==================== RENDER ====================

function render() {

    cards = buildCards();

    currentCard = 0;

    if (cards.length <= 2) {
        storyEl.hidden = true;
        emptyEl.hidden = false;
        emptyTextEl.textContent =
            `Nothing logged in ${selectedYear} yet. Add a few items or memories and come back.`;
        return;
    }

    storyEl.hidden = false;
    emptyEl.hidden = true;

    renderProgress();
    renderCard();

}


function renderProgress() {

    progressEl.innerHTML = "";

    cards.forEach((_, i) => {
        const dot = document.createElement("div");
        dot.className = "recap-dot";
        if (i < currentCard) dot.classList.add("seen");
        if (i === currentCard) dot.classList.add("active");
        progressEl.appendChild(dot);
    });

}


function renderCard() {

    const card = cards[currentCard];

    if (!card) return;

    // Apply category gradient to the card
    const theme = getTheme(card.category);
    cardEl.style.background = theme.gradient;

    cardEl.classList.add("recap-animating");

    cardEl.innerHTML = buildCardHTML(card, theme);

    setTimeout(() => {
        cardEl.classList.remove("recap-animating");
    }, 400);

    renderProgress();

    prevBtn.style.visibility = currentCard === 0 ? "hidden" : "visible";
    nextBtn.style.visibility =
        currentCard === cards.length - 1 ? "hidden" : "visible";

    // Load the memory card's photo
    if (card.theme === "memory-photo") {
        attachMemoryPhoto(card, theme);
    }

}


function buildCardHTML(card, theme) {

    const eyebrow = `
        <span class="recap-eyebrow">${escapeHTML(card.eyebrow || "")}</span>
    `;

    if (card.theme === "welcome") {
        return `
            <div class="recap-inner">
                ${eyebrow}
                <h2 class="recap-title">${escapeHTML(card.title)}</h2>
                <p class="recap-subtitle">${escapeHTML(card.subtitle)}</p>
            </div>
        `;
    }

    if (card.theme === "closing") {
        return `
            <div class="recap-inner recap-closing">
                ${eyebrow}
                <h2 class="recap-title">${escapeHTML(card.title)}</h2>
                <p class="recap-subtitle">${escapeHTML(card.subtitle)}</p>
                <div class="recap-heart">
                    <i class="bx bx-heart"></i>
                </div>
            </div>
        `;
    }

    if (card.theme === "memory-photo") {
        return `
            <div class="recap-inner">
                ${eyebrow}

                <div class="recap-photo-wrap" id="recapPhotoWrap">
                    <div class="recap-photo-placeholder">
                        <i class="bx ${theme.icon}"></i>
                    </div>
                </div>

                <h2 class="recap-title recap-title-small">
                    ${escapeHTML(card.title)}
                </h2>

                ${card.subtitle
                    ? `<p class="recap-subtitle">${escapeHTML(card.subtitle)}</p>`
                    : ""}
            </div>
        `;
    }

    if (card.theme === "highlight") {
        return `
            <div class="recap-inner">
                ${eyebrow}
                <h2 class="recap-title recap-title-small">
                    ${escapeHTML(card.title)}
                </h2>
                <p class="recap-subtitle">${escapeHTML(card.subtitle)}</p>
            </div>
        `;
    }

    if (card.big !== undefined) {
        return `
            <div class="recap-inner">
                ${eyebrow}
                <div class="recap-big">${escapeHTML(String(card.big))}</div>
                <h3 class="recap-subtitle-large">${escapeHTML(card.title || "")}</h3>
                ${card.subtitle ? `<p class="recap-subtitle">${escapeHTML(card.subtitle)}</p>` : ""}
            </div>
        `;
    }

    return `
        <div class="recap-inner">
            ${eyebrow}
            <h2 class="recap-title">${escapeHTML(card.title || "")}</h2>
        </div>
    `;

}


// ==================== PHOTO LOADING (MealDB → Unsplash → icon) ====================

async function attachMemoryPhoto(card, theme) {

    const wrap = document.getElementById("recapPhotoWrap");
    if (!wrap) return;

    let url = null;

    // 1) Try TheMealDB if the memory looks like a food entry
    if (card.dishName) {
        url = await lookupMealDB(card.dishName);
    }

    // 2) Fall back to Unsplash Source using the category theme
    if (!url) {
        url = `https://source.unsplash.com/400x400/?${encodeURIComponent(theme.unsplash)}`;
    }

    // Swap in the image. If it fails, keep the icon placeholder.
    wrap.innerHTML = `
        <img
            src="${url}"
            alt=""
            class="recap-photo"
            onerror="this.outerHTML='<div class=&quot;recap-photo-placeholder&quot;><i class=&quot;bx ${theme.icon}&quot;></i></div>'"
        >
    `;

}


async function lookupMealDB(dishName) {

    if (!dishName) return null;

    const cacheKey = "mealdb:" + dishName.toLowerCase();

    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
        return cached === "none" ? null : cached;
    }

    try {

        const firstWord = dishName.split(" ")[0].toLowerCase();

        const res = await fetch(
            "https://www.themealdb.com/api/json/v1/1/search.php?s=" +
            encodeURIComponent(firstWord)
        );

        if (!res.ok) {
            sessionStorage.setItem(cacheKey, "none");
            return null;
        }

        const data = await res.json();
        const url = data?.meals?.[0]?.strMealThumb || null;

        sessionStorage.setItem(cacheKey, url || "none");

        return url;

    } catch (error) {
        console.warn("MealDB lookup failed:", error);
        sessionStorage.setItem(cacheKey, "none");
        return null;
    }

}


// Extracts a plausible dish name from a memory title.
//   "Lunch: Rice and Beans" → "Rice and Beans"
//   "First date at the beach" → null
function extractDishName(title) {

    if (!title) return null;

    const t = title.trim();
    const m = t.match(/^[A-Za-z]+\s*:\s*(.+)$/);

    if (m && m[1]) return m[1].trim();

    return null;

}


// ==================== NAVIGATION ====================

function goNext() {
    if (currentCard >= cards.length - 1) return;
    currentCard++;
    renderCard();
}

function goPrev() {
    if (currentCard <= 0) return;
    currentCard--;
    renderCard();
}

nextBtn.addEventListener("click", goNext);
prevBtn.addEventListener("click", goPrev);

cardEl.addEventListener("click", goNext);

document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        goNext();
    }
    if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
    }
});


// ==================== HELPERS ====================

function tsYear(ts) {
    if (!ts) return null;
    const d = tsToDate(ts);
    return d ? d.getFullYear() : null;
}

function tsMonth(ts) {
    if (!ts) return null;
    const d = tsToDate(ts);
    return d ? d.getMonth() : null;
}

function tsSeconds(ts) {
    if (!ts) return 0;
    if (ts.seconds) return ts.seconds;
    if (ts.toDate) return ts.toDate().getTime() / 1000;
    return 0;
}

function tsToDate(ts) {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


// ==================== MOBILE SIDEBAR ====================

const menuButton = document.getElementById("menuButton");
const sidebar = document.getElementById("sidebar");
const sidebarClose = document.getElementById("sidebarClose");

menuButton?.addEventListener("click", () => sidebar.classList.add("open"));
sidebarClose?.addEventListener("click", () => sidebar.classList.remove("open"));

document.addEventListener("click", (event) => {
    if (
        window.innerWidth <= 850 &&
        sidebar &&
        sidebar.classList.contains("open") &&
        menuButton &&
        !sidebar.contains(event.target) &&
        !menuButton.contains(event.target)
    ) {
        sidebar.classList.remove("open");
    }
});
