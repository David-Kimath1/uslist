import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { logEvent } from "./timeline-logger.js";
import { toastWarning, toastError } from "./toast.js";


// ==================== STATE ====================

let currentUser = null;
let currentUsername = null;
let coupleId = null;
let partnerUid = null;

let capsules = [];
let currentFilter = "all";

let capsuleToDelete = null;

let unsubscribe = null;
let ticker = null;
let readerTicker = null;
let readingCapsuleId = null;


// ==================== ELEMENTS ====================

const capsuleGrid = document.getElementById("capsuleGrid");
const capsuleEmptyState = document.getElementById("capsuleEmptyState");
const filterButtons = document.querySelectorAll(
    ".capsule-filters .filter-button"
);

const capsuleModal = document.getElementById("capsuleModal");
const openCapsuleModal = document.getElementById("openCapsuleModal");
const emptyCapsuleButton = document.getElementById("emptyCapsuleButton");
const closeCapsuleModal = document.getElementById("closeCapsuleModal");
const cancelCapsule = document.getElementById("cancelCapsule");
const capsuleForm = document.getElementById("capsuleForm");
const capsuleSubmit = document.getElementById("capsuleSubmit");
const capsuleDateInput = document.getElementById("capsuleDate");

const readerModal = document.getElementById("capsuleReaderModal");
const readerCategory = document.getElementById("capsuleReaderCategory");
const readerByline = document.getElementById("capsuleReaderByline");
const readerTitle = document.getElementById("capsuleReaderTitle");
const readerBody = document.getElementById("capsuleReaderBody");
const readerActions = document.getElementById("capsuleReaderActions");
const closeReaderBtn = document.getElementById("closeCapsuleReader");

const deleteModal = document.getElementById("deleteCapsuleModal");
const deleteText = document.getElementById("deleteCapsuleText");
const cancelDelete = document.getElementById("cancelCapsuleDelete");
const confirmDelete = document.getElementById("confirmCapsuleDelete");


// ==================== BOOTSTRAP ====================

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    currentUsername = userData.username || "you";

    if (!userData.coupleId) return;

    coupleId = userData.coupleId;

    const coupleSnap = await getDoc(doc(db, "couples", coupleId));
    if (coupleSnap.exists()) {
        const c = coupleSnap.data();
        partnerUid =
            c.member1Uid === user.uid ? c.member2Uid : c.member1Uid;
    }

    subscribeToCapsules();
    startTicker();

});


function subscribeToCapsules() {

    if (unsubscribe) unsubscribe();

    const ref = query(
        collection(db, "couples", coupleId, "capsules"),
        orderBy("createdAt", "desc")
    );

    unsubscribe = onSnapshot(ref, (snap) => {

        capsules = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        render();

    });

}


function startTicker() {
    if (ticker) clearInterval(ticker);
    // Full re-render every 30s (heavier — updates statuses, progress bars)
    ticker = setInterval(render, 30000);

    // Lightweight 1s tick — updates just the countdown numbers in-place
    if (window.__capsuleTick) clearInterval(window.__capsuleTick);
    window.__capsuleTick = setInterval(tickCountdowns, 1000);
}


function tickCountdowns() {

    document
        .querySelectorAll("[data-capsule-countdown]")
        .forEach((el) => {

            const id = el.dataset.capsuleCountdown;
            const c = capsules.find((x) => x.id === id);
            if (!c) return;

            const diff = unlockDate(c) - Date.now();

            if (diff <= 0) {
                // Hit zero — do a full re-render to transition to unlocked
                render();
                return;
            }

            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);

            const span = el.querySelector("span");
            if (span) {
                span.textContent =
                    `${d}d ${String(h).padStart(2,"0")}h ` +
                    `${String(m).padStart(2,"0")}m ` +
                    `${String(s).padStart(2,"0")}s`;
            }

        });

}


// ==================== FILTERS ====================

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        currentFilter = button.dataset.filter;
        render();
    });
});


// ==================== HELPERS ====================

function isUnlocked(c) {
    if (!c.unlockAt) return false;
    return new Date(c.unlockAt + "T00:00:00").getTime() <= Date.now();
}

function isMine(c) {
    return c.createdBy === currentUser.uid;
}

function unlockDate(c) {
    return new Date(c.unlockAt + "T00:00:00").getTime();
}


// ==================== RENDER ====================

function render() {

    if (!currentUser) return;

    let filtered = capsules;

    if (currentFilter === "locked") {
        filtered = capsules.filter((c) => !isUnlocked(c));
    }

    if (currentFilter === "unlocked") {
        filtered = capsules.filter((c) => isUnlocked(c));
    }

    capsuleGrid.innerHTML = "";

    if (filtered.length === 0) {
        capsuleEmptyState.classList.add("visible");
        return;
    }

    capsuleEmptyState.classList.remove("visible");

    filtered.forEach((c) => {
        capsuleGrid.appendChild(createCapsuleCard(c));
    });

}


function createCapsuleCard(c) {

    const el = document.createElement("article");
    el.className = "capsule-card";
    el.dataset.id = c.id;

    const unlocked = isUnlocked(c);
    const mine = isMine(c);

    // Three states:
    //   1. Unlocked → "Opened" badge
    //   2. Locked + mine → "Sealed by you" badge + content previewable
    //   3. Locked + theirs → "Sealed by partner" + countdown, no content

    let statusLabel, statusClass, lockIcon;

    if (unlocked) {
        statusLabel = "Opened";
        statusClass = "unlocked";
        lockIcon = "bx-lock-open-alt";
    } else if (mine) {
        statusLabel = "Sealed by you";
        statusClass = "locked";
        lockIcon = "bx-lock-alt";
    } else {
        statusLabel = "Sealed by partner";
        statusClass = "locked";
        lockIcon = "bx-lock-alt";
    }

    el.innerHTML = `
        <div class="capsule-lock-wrap">
            <div class="capsule-lock-icon">
                <i class="bx ${lockIcon}"></i>
            </div>

            <div class="capsule-lock-label">
                <span class="capsule-status ${statusClass}">${statusLabel}</span>
                ${mine
                    ? `<span class="capsule-mine">Yours</span>`
                    : `<span class="capsule-theirs">From partner</span>`}
            </div>
        </div>

        <h3 class="capsule-title">${escapeHTML(c.title)}</h3>

        <span class="capsule-unlock-at">
            <i class="bx bx-calendar-heart"></i>
            Opens ${formatUnlockDate(c.unlockAt)}
        </span>

        ${!unlocked ? buildLiveCountdown(c) : ""}

        <div class="capsule-progress">
            <div class="capsule-progress-bar" style="width:${computeProgress(c)}%"></div>
        </div>

        <div class="capsule-footer">
            <span class="capsule-audience">
                <i class="bx ${c.audience === "me" ? "bx-user" : "bx-group"}"></i>
                ${c.audience === "me" ? "Just you" : "Both of you"}
            </span>
        </div>
    `;

    el.addEventListener("click", () => openCapsule(c));

    return el;

}


function buildLiveCountdown(c) {

    const diff = unlockDate(c) - Date.now();

    if (diff <= 0) return "";

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return `
        <div class="capsule-countdown" data-capsule-countdown="${c.id}">
            <i class="bx bx-hourglass"></i>
            <span>
                ${d}d ${String(h).padStart(2,"0")}h
                ${String(m).padStart(2,"0")}m
                ${String(s).padStart(2,"0")}s
            </span>
        </div>
    `;

}


function computeProgress(c) {

    if (!c.createdAt || !c.unlockAt) return 0;

    let created;
    if (c.createdAt.toDate) created = c.createdAt.toDate();
    else if (c.createdAt.seconds) created = new Date(c.createdAt.seconds * 1000);
    else return 0;

    const unlock = unlockDate(c);
    const total = unlock - created.getTime();
    const elapsed = Date.now() - created.getTime();

    if (total <= 0) return 100;

    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));

}


// ==================== OPEN CAPSULE ====================

function openCapsule(c) {

    readingCapsuleId = c.id;

    const unlocked = isUnlocked(c);
    const mine = isMine(c);

    // CATEGORY BYLINE
    if (unlocked) {
        readerCategory.textContent = "Opened";
    } else if (mine) {
        readerCategory.textContent = "Sealed by you";
    } else {
        readerCategory.textContent = "Sealed";
    }

    const sealedOn = c.createdAt?.toDate
        ? c.createdAt.toDate()
        : c.createdAt?.seconds
            ? new Date(c.createdAt.seconds * 1000)
            : null;

    readerByline.textContent =
        (mine ? "Yours" : "From your partner") +
        (sealedOn
            ? ` · Sealed ${sealedOn.toLocaleDateString(undefined, {
                day: "numeric", month: "short", year: "numeric"
              })}`
            : "") +
        ` · Opens ${formatUnlockDate(c.unlockAt)}`;

    readerTitle.textContent = c.title;

    readerBody.innerHTML = "";
    readerActions.innerHTML = "";


    // ============ CASE 1: Unlocked — show body ============

    if (unlocked) {

        readerBody.textContent = c.body || "";

        if (mine) {
            const del = document.createElement("button");
            del.className = "danger-button";
            del.innerHTML = '<i class="bx bx-trash"></i> Delete';
            del.addEventListener("click", () => {
                closeReader();
                openDeleteModal(c.id);
            });
            readerActions.appendChild(del);
        }

    }

    // ============ CASE 2: Locked + mine — show content, badge, no edit ============

    else if (mine) {

        readerBody.innerHTML = `
            <div class="capsule-author-view">
                <div class="capsule-locked-note">
                    <i class="bx bx-lock-alt"></i>
                    <span>This capsule is sealed and cannot be changed.</span>
                </div>
                <div class="capsule-author-body">
                    ${escapeHTML(c.body || "").replace(/\n/g, "<br>")}
                </div>
            </div>
        `;

        const del = document.createElement("button");
        del.className = "danger-button";
        del.innerHTML = '<i class="bx bx-trash"></i> Delete';
        del.addEventListener("click", () => {
            closeReader();
            openDeleteModal(c.id);
        });
        readerActions.appendChild(del);

        // If anyone tries to "edit", we notify via the toast.
        // There is no edit button — but we warn when the doc is tapped
        // after they've been told. Actually just show the toast once:
        toastWarning("Capsules are sealed on save and cannot be edited.");

    }

    // ============ CASE 3: Locked + theirs — live countdown ============

    else {

        readerBody.innerHTML = `
            <div class="capsule-partner-view">
                <div class="capsule-lock-big">
                    <i class="bx bx-lock-alt"></i>
                </div>
                <p class="capsule-partner-title">
                    Sealed by ${escapeHTML(currentUsername === "you" ? "your partner" : "your partner")}
                </p>
                <p class="capsule-partner-sub">
                    This letter will be revealed on
                    <strong>${formatUnlockDate(c.unlockAt)}</strong>.
                </p>

                <div class="capsule-big-countdown" id="capsuleBigCountdown">
                    <div class="capsule-big-block">
                        <strong data-unit="days">--</strong>
                        <span>Days</span>
                    </div>
                    <div class="capsule-big-block">
                        <strong data-unit="hours">--</strong>
                        <span>Hours</span>
                    </div>
                    <div class="capsule-big-block">
                        <strong data-unit="minutes">--</strong>
                        <span>Minutes</span>
                    </div>
                    <div class="capsule-big-block">
                        <strong data-unit="seconds">--</strong>
                        <span>Seconds</span>
                    </div>
                </div>

                <p class="capsule-partner-hint">
                    Be patient — some things are worth waiting for.
                </p>
            </div>
        `;

        startBigCountdown(unlockDate(c));

    }

    readerModal.classList.add("show");

}


// ==================== BIG COUNTDOWN (reader) ====================

function startBigCountdown(targetTime) {

    stopBigCountdown();

    const el = () => document.getElementById("capsuleBigCountdown");

    const update = () => {

        const root = el();
        if (!root) return;

        const diff = targetTime - Date.now();

        if (diff <= 0) {
            stopBigCountdown();
            // Refresh the page so the just-unlocked capsule re-renders
            closeReader();
            render();
            return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        root.querySelector('[data-unit="days"]').textContent = d;
        root.querySelector('[data-unit="hours"]').textContent =
            String(h).padStart(2, "0");
        root.querySelector('[data-unit="minutes"]').textContent =
            String(m).padStart(2, "0");
        root.querySelector('[data-unit="seconds"]').textContent =
            String(s).padStart(2, "0");

    };

    update();
    readerTicker = setInterval(update, 1000);

}


function stopBigCountdown() {
    if (readerTicker) {
        clearInterval(readerTicker);
        readerTicker = null;
    }
}


// ==================== WRITE MODAL ====================

function openModal() {

    capsuleModalEyebrow.textContent = "NEW CAPSULE";
    capsuleModalTitle.textContent = "Seal a capsule";
    capsuleSubmit.innerHTML = '<i class="bx bx-lock-alt"></i> Seal capsule';

    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    capsuleDateInput.value = d.toISOString().slice(0, 10);
    capsuleDateInput.min = new Date(Date.now() + 86400000)
        .toISOString().slice(0, 10);

    capsuleModal.classList.add("show");

    setTimeout(() => {
        document.getElementById("capsuleTitle").focus();
    }, 100);

}


function closeModal() {
    capsuleModal.classList.remove("show");
    capsuleForm.reset();
}


openCapsuleModal?.addEventListener("click", openModal);
emptyCapsuleButton?.addEventListener("click", openModal);
closeCapsuleModal?.addEventListener("click", closeModal);
cancelCapsule?.addEventListener("click", closeModal);

capsuleModal?.addEventListener("click", (event) => {
    if (event.target === capsuleModal) closeModal();
});


capsuleForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId || !currentUser) return;

    const title = document.getElementById("capsuleTitle").value.trim();
    const unlockAt = capsuleDateInput.value;
    const body = document.getElementById("capsuleBody").value.trim();

    const audRadio = document.querySelector(
        'input[name="capsuleAudience"]:checked'
    );
    const audience = audRadio ? audRadio.value : "both";

    if (!title || !unlockAt || !body) return;

    if (new Date(unlockAt + "T00:00:00").getTime() <= Date.now()) {
        toastWarning("Pick a date in the future.");
        return;
    }

    try {

        capsuleSubmit.disabled = true;
        capsuleSubmit.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Sealing...';

        await addDoc(
            collection(db, "couples", coupleId, "capsules"),
            {
                title,
                body,
                unlockAt,
                audience,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                openedAt: null
            }
        );

        await logEvent("capsule_sealed", { title, unlockAt });

        closeModal();

    } catch (error) {

        console.error("Save capsule error:", error);
        toastError("Could not save. Please try again.");

    } finally {

        capsuleSubmit.disabled = false;
        capsuleSubmit.innerHTML =
            '<i class="bx bx-lock-alt"></i> Seal capsule';

    }

});


// ==================== READER CLOSE ====================

function closeReader() {
    stopBigCountdown();
    readerModal.classList.remove("show");
    readingCapsuleId = null;
}

closeReaderBtn?.addEventListener("click", closeReader);

readerModal?.addEventListener("click", (event) => {
    if (event.target === readerModal) closeReader();
});


// ==================== DELETE ====================

function openDeleteModal(id) {

    const c = capsules.find((x) => x.id === id);
    if (!c) return;

    capsuleToDelete = id;
    deleteText.textContent =
        `"${c.title}" will be permanently removed.`;
    deleteModal.classList.add("show");

}

function closeDeleteModal() {
    deleteModal.classList.remove("show");
    capsuleToDelete = null;
}

cancelDelete?.addEventListener("click", closeDeleteModal);

confirmDelete?.addEventListener("click", async () => {

    if (!capsuleToDelete) return;

    try {
        await deleteDoc(
            doc(db, "couples", coupleId, "capsules", capsuleToDelete)
        );
        closeDeleteModal();
    } catch (error) {
        console.error("Delete capsule error:", error);
        toastError("Could not delete.");
        closeDeleteModal();
    }

});

deleteModal?.addEventListener("click", (event) => {
    if (event.target === deleteModal) closeDeleteModal();
});


// ==================== ESC ====================

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (capsuleModal?.classList.contains("show")) closeModal();
    if (deleteModal?.classList.contains("show")) closeDeleteModal();
    if (readerModal?.classList.contains("show")) closeReader();
});


// ==================== HELPERS ====================

function formatUnlockDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, {
        day: "numeric", month: "short", year: "numeric"
    });
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
