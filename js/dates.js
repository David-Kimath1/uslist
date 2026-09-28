import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { logEvent } from "./timeline-logger.js";
import { toastError } from "./toast.js";


let currentUser = null;
let coupleId = null;
let dates = [];
let currentFilter = "all";
let dateToDelete = null;
let unsubscribe = null;
let heroTicker = null;
let cardTickers = [];


const datesGrid = document.getElementById("datesGrid");
const datesEmptyState = document.getElementById("datesEmptyState");
const dateCount = document.getElementById("dateCount");

const dateModal = document.getElementById("dateModal");
const openDateModal = document.getElementById("openDateModal");
const emptyAddDateButton = document.getElementById("emptyAddDateButton");
const closeDateModal = document.getElementById("closeDateModal");
const cancelDate = document.getElementById("cancelDate");
const dateForm = document.getElementById("dateForm");
const dateSubmit = document.getElementById("dateSubmit");

const deleteDateModal = document.getElementById("deleteDateModal");
const deleteDateText = document.getElementById("deleteDateText");
const cancelDateDelete = document.getElementById("cancelDateDelete");
const confirmDateDelete = document.getElementById("confirmDateDelete");

const heroCountdown = document.getElementById("datesHeroCountdown");
const heroTitle = document.getElementById("heroTitle");
const heroDate = document.getElementById("heroDate");
const heroDays = document.getElementById("heroDays");
const heroHours = document.getElementById("heroHours");
const heroMinutes = document.getElementById("heroMinutes");
const heroSeconds = document.getElementById("heroSeconds");

const filterButtons = document.querySelectorAll(".dates-toolbar .filter-button");


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();

    if (!userData.coupleId) {
        showEmpty("Connect with your partner first.");
        return;
    }

    coupleId = userData.coupleId;
    subscribeToDates();

});


function subscribeToDates() {

    if (unsubscribe) unsubscribe();

    const ref = query(
        collection(db, "couples", coupleId, "dates"),
        orderBy("date", "asc")
    );

    unsubscribe = onSnapshot(ref, (snapshot) => {

        dates = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        renderDates();
        renderHeroCountdown();

    });

}


function openModal() {
    dateModal.classList.add("show");
    setTimeout(() => {
        document.getElementById("dateTitle").focus();
    }, 100);
}

function closeModal() {
    dateModal.classList.remove("show");
    dateForm.reset();
    document.getElementById("dateImportant").checked = true;
}

openDateModal.addEventListener("click", openModal);
emptyAddDateButton.addEventListener("click", openModal);
closeDateModal.addEventListener("click", closeModal);
cancelDate.addEventListener("click", closeModal);

dateModal.addEventListener("click", (event) => {
    if (event.target === dateModal) closeModal();
});


dateForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId) return;

    const title = document.getElementById("dateTitle").value.trim();
    const dateValue = document.getElementById("dateValue").value;
    const notes = document.getElementById("dateNotes").value.trim();
    const recurring = document.getElementById("dateRecurring").checked;
    const important = document.getElementById("dateImportant").checked;

    const category = document.querySelector(
        'input[name="dateCategory"]:checked'
    ).value;

    if (!title || !dateValue) return;

    try {

        dateSubmit.disabled = true;
        dateSubmit.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        await addDoc(
            collection(db, "couples", coupleId, "dates"),
            {
                title,
                date: dateValue,
                category,
                recurring,
                important,
                notes,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        // Log to timeline
        await logEvent("date_added", {
            title,
            category,
            date: dateValue
        });

        closeModal();

    } catch (error) {

        console.error("Add date error:", error);
        toastError("Could not save date.");

    } finally {

        dateSubmit.disabled = false;
        dateSubmit.innerHTML =
            '<i class="bx bx-heart"></i> Save Date';

    }

});


function openDeleteModal(id) {

    const d = dates.find((x) => x.id === id);
    if (!d) return;

    dateToDelete = id;
    deleteDateText.textContent =
        `"${d.title}" will be permanently removed.`;
    deleteDateModal.classList.add("show");

}

function closeDeleteModal() {
    deleteDateModal.classList.remove("show");
    dateToDelete = null;
}

cancelDateDelete.addEventListener("click", closeDeleteModal);

confirmDateDelete.addEventListener("click", async () => {

    if (!dateToDelete) return;

    try {
        await deleteDoc(
            doc(db, "couples", coupleId, "dates", dateToDelete)
        );
        closeDeleteModal();
    } catch (error) {
        console.error("Delete error:", error);
        closeDeleteModal();
    }

});

deleteDateModal.addEventListener("click", (event) => {
    if (event.target === deleteDateModal) closeDeleteModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (dateModal.classList.contains("show")) closeModal();
    if (deleteDateModal.classList.contains("show")) closeDeleteModal();
});


filterButtons.forEach((button) => {
    button.addEventListener("click", () => {

        filterButtons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");

        currentFilter = button.dataset.filter;
        renderDates();

    });
});


function renderDates() {

    let filtered = dates;

    if (currentFilter !== "all") {
        filtered = dates.filter((d) => d.category === currentFilter);
    }

    filtered = [...filtered].sort(
        (a, b) => nextOccurrence(a) - nextOccurrence(b)
    );

    datesGrid.innerHTML = "";

    dateCount.textContent =
        `${filtered.length} ${
            filtered.length === 1 ? "date" : "dates"
        }`;

    if (filtered.length === 0) {
        datesEmptyState.classList.add("visible");
        return;
    }

    datesEmptyState.classList.remove("visible");

    filtered.forEach((d) => {
        datesGrid.appendChild(createDateCard(d));
    });

    startCardTickers();

}


function createDateCard(d) {

    const article = document.createElement("article");
    article.className = "date-card";
    article.dataset.id = d.id;

    article.innerHTML = `
        <div class="date-card-top">
            <span class="date-card-category">
                ${formatCategory(d.category)}
            </span>
            ${
                d.important
                    ? `<span class="date-card-star" title="Important">
                           <i class="bx bxs-star"></i>
                       </span>`
                    : ""
            }
        </div>

        <h3 class="date-card-title">${escapeHTML(d.title)}</h3>

        <p class="date-card-date">
            <i class="bx bx-calendar"></i>
            ${formatDate(d.date, d.recurring)}
            ${d.recurring ? " · Every year" : ""}
        </p>

        ${
            d.notes
                ? `<p class="date-card-notes">${escapeHTML(d.notes)}</p>`
                : ""
        }

        <div class="date-card-countdown">
            <div><strong data-days>--</strong><span>Days</span></div>
            <div><strong data-hours>--</strong><span>Hrs</span></div>
            <div><strong data-mins>--</strong><span>Min</span></div>
            <div><strong data-secs>--</strong><span>Sec</span></div>
        </div>

        <button
            class="date-card-delete"
            data-action="delete"
            data-id="${d.id}"
            aria-label="Delete"
        >
            <i class="bx bx-trash"></i>
        </button>
    `;

    return article;

}


datesGrid.addEventListener("click", (event) => {

    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "delete") {
        openDeleteModal(button.dataset.id);
    }

});


function renderHeroCountdown() {

    const important = dates.filter((d) => d.important);

    if (important.length === 0) {
        heroCountdown.hidden = true;
        return;
    }

    important.sort((a, b) => nextOccurrence(a) - nextOccurrence(b));

    const next = important[0];

    heroCountdown.hidden = false;
    heroTitle.textContent = next.title;
    heroDate.textContent =
        formatDate(next.date, next.recurring) +
        (next.recurring ? " · Every year" : "");

    if (heroTicker) clearInterval(heroTicker);

    const update = () => {

        const diff = nextOccurrence(next) - Date.now();

        if (diff <= 0) {
            heroDays.textContent = "00";
            heroHours.textContent = "00";
            heroMinutes.textContent = "00";
            heroSeconds.textContent = "00";
            return;
        }

        const s = Math.floor(diff / 1000);

        heroDays.textContent =
            String(Math.floor(s / 86400)).padStart(2, "0");
        heroHours.textContent =
            String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
        heroMinutes.textContent =
            String(Math.floor((s % 3600) / 60)).padStart(2, "0");
        heroSeconds.textContent =
            String(s % 60).padStart(2, "0");

    };

    update();
    heroTicker = setInterval(update, 1000);

}


function startCardTickers() {

    cardTickers.forEach((t) => clearInterval(t));
    cardTickers = [];

    document.querySelectorAll(".date-card").forEach((card) => {

        const id = card.dataset.id;
        const d = dates.find((x) => x.id === id);
        if (!d) return;

        const days = card.querySelector("[data-days]");
        const hours = card.querySelector("[data-hours]");
        const mins = card.querySelector("[data-mins]");
        const secs = card.querySelector("[data-secs]");

        const update = () => {

            const diff = nextOccurrence(d) - Date.now();

            if (diff <= 0) {
                days.textContent = "00";
                hours.textContent = "00";
                mins.textContent = "00";
                secs.textContent = "00";
                return;
            }

            const s = Math.floor(diff / 1000);

            days.textContent = String(Math.floor(s / 86400)).padStart(2, "0");
            hours.textContent = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
            mins.textContent = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
            secs.textContent = String(s % 60).padStart(2, "0");

        };

        update();
        cardTickers.push(setInterval(update, 1000));

    });

}


function nextOccurrence(d) {

    const [y, m, day] = d.date.split("-").map(Number);
    const now = new Date();

    let target = new Date(y, m - 1, day, 0, 0, 0);

    if (d.recurring) {
        target = new Date(
            now.getFullYear(),
            m - 1,
            day,
            0, 0, 0
        );

        if (target.getTime() < now.getTime() - 86400000) {
            target = new Date(
                now.getFullYear() + 1,
                m - 1,
                day,
                0, 0, 0
            );
        }
    }

    return target.getTime();

}


function formatDate(dateString, recurring) {

    if (!dateString) return "";

    const [y, m, d] = dateString.split("-").map(Number);
    const date = new Date(y, m - 1, d);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: recurring ? undefined : "numeric"
    });

}


function formatCategory(cat) {

    const map = {
        anniversary: "Anniversary",
        birthday: "Birthday",
        first: "First",
        milestone: "Milestone",
        other: "Other"
    };

    return map[cat] || "Date";

}


function escapeHTML(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

}


function showEmpty(message) {

    datesGrid.innerHTML = "";
    dateCount.textContent = "0 dates";

    const p = datesEmptyState.querySelector("p");
    if (p) p.textContent = message;

    datesEmptyState.classList.add("visible");
}


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
