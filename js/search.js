import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


let currentUser = null;
let coupleId = null;

let items = [];
let memories = [];
let dates = [];
let notes = [];

let currentFilter = "all";

let itemsSub = null;
let memoriesSub = null;
let datesSub = null;
let notesSub = null;


const overlay = document.getElementById("searchOverlay");
const openBtn = document.getElementById("openSearch");
const closeBtn = document.getElementById("closeSearch");
const backdrop = document.getElementById("searchBackdrop");
const input = document.getElementById("searchInput");
const results = document.getElementById("searchResults");
const hint = document.getElementById("searchHint");
const filterBtns = document.querySelectorAll(".search-filter");


// ==================== BOOTSTRAP ====================

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    coupleId = userData.coupleId;

    subscribeAll();

});


function subscribeAll() {

    if (itemsSub) itemsSub();
    if (memoriesSub) memoriesSub();
    if (datesSub) datesSub();
    if (notesSub) notesSub();

    itemsSub = onSnapshot(
        collection(db, "couples", coupleId, "items"),
        (snap) => {
            items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((i) =>
                    i.visibility === "shared" ||
                    i.createdBy === currentUser.uid
                );
            runSearch();
        }
    );

    memoriesSub = onSnapshot(
        collection(db, "couples", coupleId, "memories"),
        (snap) => {
            memories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            runSearch();
        }
    );

    datesSub = onSnapshot(
        collection(db, "couples", coupleId, "dates"),
        (snap) => {
            dates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            runSearch();
        }
    );

    // Notes collection may not exist yet — that's fine
    notesSub = onSnapshot(
        collection(db, "couples", coupleId, "notes"),
        (snap) => {
            notes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            runSearch();
        },
        () => {
            // Silent fail — notes feature may not be built yet
            notes = [];
        }
    );

}


// ==================== OPEN / CLOSE ====================

function openSearch() {
    overlay.hidden = false;
    document.body.style.overflow = "hidden";

    setTimeout(() => {
        input.focus();
    }, 50);
}

function closeSearch() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    input.value = "";

    runSearch();
}


openBtn?.addEventListener("click", openSearch);
closeBtn?.addEventListener("click", closeSearch);
backdrop?.addEventListener("click", closeSearch);


document.addEventListener("keydown", (event) => {

    // Cmd/Ctrl + K opens search
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (overlay.hidden) openSearch();
        else closeSearch();
    }

    if (event.key === "Escape" && !overlay.hidden) {
        closeSearch();
    }

});


input?.addEventListener("input", runSearch);


// ==================== FILTERS ====================

filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {

        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        currentFilter = btn.dataset.filter;
        runSearch();

    });
});


// ==================== SEARCH ====================

function runSearch() {

    const q = input.value.trim().toLowerCase();

    if (!q) {
        results.innerHTML = "";
        results.appendChild(buildHint());
        return;
    }

    const matches = [];

    // Items
    if (currentFilter === "all" || currentFilter === "items") {
        items.forEach((i) => {
            if (itemMatches(i, q)) {
                matches.push({
                    type: "item",
                    id: i.id,
                    title: i.title,
                    subtitle: i.description || "",
                    meta: i.category,
                    completed: i.completed
                });
            }
        });
    }

    // Memories
    if (currentFilter === "all" || currentFilter === "memories") {
        memories.forEach((m) => {
            if (memoryMatches(m, q)) {
                matches.push({
                    type: "memory",
                    id: m.id,
                    title: m.title,
                    subtitle: m.description || "",
                    meta: m.category
                });
            }
        });
    }

    // Dates
    if (currentFilter === "all" || currentFilter === "dates") {
        dates.forEach((d) => {
            if (dateMatches(d, q)) {
                matches.push({
                    type: "date",
                    id: d.id,
                    title: d.title,
                    subtitle: d.notes || "",
                    meta: d.category
                });
            }
        });
    }

    // Notes (future)
    if (currentFilter === "all" || currentFilter === "notes") {
        notes.forEach((n) => {
            if (noteMatches(n, q)) {
                matches.push({
                    type: "note",
                    id: n.id,
                    title: n.title || "Note",
                    subtitle: n.body || "",
                    meta: "note"
                });
            }
        });
    }

    renderResults(matches, q);

}


function itemMatches(i, q) {
    return (i.title || "").toLowerCase().includes(q)
        || (i.description || "").toLowerCase().includes(q)
        || (i.category || "").toLowerCase().includes(q);
}

function memoryMatches(m, q) {
    return (m.title || "").toLowerCase().includes(q)
        || (m.description || "").toLowerCase().includes(q)
        || (m.category || "").toLowerCase().includes(q);
}

function dateMatches(d, q) {
    return (d.title || "").toLowerCase().includes(q)
        || (d.notes || "").toLowerCase().includes(q)
        || (d.category || "").toLowerCase().includes(q);
}

function noteMatches(n, q) {
    return (n.title || "").toLowerCase().includes(q)
        || (n.body || "").toLowerCase().includes(q);
}


// ==================== RENDER ====================

function buildHint() {
    const el = document.createElement("div");
    el.className = "search-hint";
    el.innerHTML = `
        <i class="bx bx-search-alt"></i>
        <p>Start typing to search across everything.</p>
    `;
    return el;
}

function buildEmpty(q) {
    const el = document.createElement("div");
    el.className = "search-hint";
    el.innerHTML = `
        <i class="bx bx-search-alt"></i>
        <p>No results for "<strong>${escapeHTML(q)}</strong>".</p>
    `;
    return el;
}


function renderResults(matches, q) {

    results.innerHTML = "";

    if (matches.length === 0) {
        results.appendChild(buildEmpty(q));
        return;
    }

    matches.forEach((m) => {

        const el = document.createElement("a");
        el.className = "search-result";
        el.href = linkFor(m.type);

        el.innerHTML = `
            <div class="search-result-icon">
                <i class="bx ${iconFor(m.type)}"></i>
            </div>

            <div class="search-result-body">
                <strong>${highlight(m.title, q)}</strong>
                ${
                    m.subtitle
                        ? `<p>${highlight(m.subtitle, q)}</p>`
                        : ""
                }
                <span class="search-result-meta">
                    ${iconForMeta(m.type)} ${m.meta || ""}
                </span>
            </div>

            <i class="bx bx-chevron-right search-result-arrow"></i>
        `;

        results.appendChild(el);

    });

}


// ==================== HELPERS ====================

function linkFor(type) {
    const inPages = location.pathname.includes("/pages/");
    const prefix = inPages ? "" : "pages/";

    switch (type) {
        case "item":     return prefix + "bucket-list.html";
        case "memory":   return prefix + "memories.html";
        case "date":     return prefix + "dates.html";
        case "note":     return prefix + "notes.html";
        default:         return prefix + "index.html";
    }
}

function iconFor(type) {
    switch (type) {
        case "item":     return "bx-list-check";
        case "memory":   return "bx-image";
        case "date":     return "bx-calendar-heart";
        case "note":     return "bx-note";
        default:         return "bx-circle";
    }
}

function iconForMeta(type) {
    switch (type) {
        case "item":     return '<i class="bx bx-list-check"></i>';
        case "memory":   return '<i class="bx bx-image"></i>';
        case "date":     return '<i class="bx bx-calendar-heart"></i>';
        case "note":     return '<i class="bx bx-note"></i>';
        default:         return "";
    }
}

function highlight(text, q) {

    if (!text) return "";

    const safe = escapeHTML(text);

    if (!q) return safe;

    const regex = new RegExp(
        "(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
        "ig"
    );

    return safe.replace(regex, "<mark>$1</mark>");
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}
