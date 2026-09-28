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
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { toastError } from "./toast.js";


// ==================== STATE ====================

let currentUser = null;
let currentUsername = null;
let coupleId = null;
let partnerUid = null;
let partnerUsername = null;

let wishes = [];

let currentTab = "mine";
let wishToDelete = null;

let sharedUnsub = null;
let privateUnsub = null;


// ==================== ELEMENTS ====================

const myList = document.getElementById("myList");
const theirList = document.getElementById("theirList");
const myCount = document.getElementById("myCount");
const theirCount = document.getElementById("theirCount");
const myEmpty = document.getElementById("myEmpty");
const theirEmpty = document.getElementById("theirEmpty");

const wishModal = document.getElementById("wishModal");
const openWishModal = document.getElementById("openWishModal");
const closeWishModal = document.getElementById("closeWishModal");
const cancelWish = document.getElementById("cancelWish");
const wishForm = document.getElementById("wishForm");
const wishSubmit = document.getElementById("wishSubmit");

const deleteWishModal = document.getElementById("deleteWishModal");
const deleteWishText = document.getElementById("deleteWishText");
const cancelWishDelete = document.getElementById("cancelWishDelete");
const confirmWishDelete = document.getElementById("confirmWishDelete");

const wishlistTabs = document.querySelectorAll(".wishlist-tab");
const wishlistColumns = document.querySelectorAll(".wishlist-column");


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

    if (partnerUid) {
        const partnerSnap = await getDoc(doc(db, "users", partnerUid));
        if (partnerSnap.exists()) {
            partnerUsername =
                partnerSnap.data().username || "partner";
        }
    }

    subscribeToWishes();

});


function subscribeToWishes() {

    if (sharedUnsub) sharedUnsub();
    if (privateUnsub) privateUnsub();

    const ref = collection(db, "couples", coupleId, "wishlist");

    // Shared items (both partners can see)
    sharedUnsub = onSnapshot(
        query(ref, where("visibility", "==", "shared")),
        (snap) => {
            mergeResults("shared", snap.docs.map((d) => ({
                id: d.id, ...d.data()
            })));
        },
        (error) => {
            console.warn("Shared wishlist:", error.message);
        }
    );

    // My own private items
    privateUnsub = onSnapshot(
        query(
            ref,
            where("visibility", "==", "private"),
            where("ownerUid", "==", currentUser.uid)
        ),
        (snap) => {
            mergeResults("private", snap.docs.map((d) => ({
                id: d.id, ...d.data()
            })));
        },
        (error) => {
            console.warn("Private wishlist:", error.message);
        }
    );

}


const buckets = { shared: [], private: [] };

function mergeResults(bucket, items) {
    buckets[bucket] = items;

    const seen = new Set();
    wishes = [...buckets.shared, ...buckets.private].filter((w) => {
        if (seen.has(w.id)) return false;
        seen.add(w.id);
        return true;
    });

    render();
}

// Show empty states immediately on page load.
// Hide them the moment real items arrive.
/* initial empty state */
if (myEmpty) myEmpty.style.display = "flex";
if (theirEmpty) theirEmpty.style.display = "flex";


// ==================== TABS (mobile) ====================

wishlistTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        wishlistTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentTab = tab.dataset.tab;
        applyTabVisibility();
    });
});

function applyTabVisibility() {

    const isMobile = window.innerWidth < 900;

    wishlistColumns.forEach((col) => {
        if (!isMobile) {
            col.style.display = "";
            return;
        }
        col.style.display =
            col.dataset.column === currentTab ? "" : "none";
    });

}

window.addEventListener("resize", applyTabVisibility);


// ==================== RENDER ====================

function render() {

    if (!currentUser) return;

    const mine = wishes.filter((w) => w.ownerUid === currentUser.uid);
    const theirs = wishes.filter((w) => w.ownerUid === partnerUid);

    renderList(myList, myCount, myEmpty, mine, true);
    renderList(theirList, theirCount, theirEmpty, theirs, false);

    applyTabVisibility();

}


function renderList(container, countEl, emptyEl, list, isMine) {

    container.innerHTML = "";

    const sorted = [...list].sort((a, b) => {
        if (!!a.bought !== !!b.bought) return a.bought ? 1 : -1;

        const rank = { high: 0, medium: 1, low: 2 };
        const ra = rank[a.priority] ?? 1;
        const rb = rank[b.priority] ?? 1;
        if (ra !== rb) return ra - rb;

        const aT = a.createdAt?.seconds ?? 0;
        const bT = b.createdAt?.seconds ?? 0;
        return bT - aT;
    });

    countEl.textContent =
        `${sorted.length} ${sorted.length === 1 ? "item" : "items"}`;

    if (sorted.length === 0) {
        emptyEl.style.display = "flex";
        return;
    }

    emptyEl.style.display = "none";

    sorted.forEach((w) => {
        container.appendChild(createWishCard(w, isMine));
    });

}


function createWishCard(w, isMine) {

    const el = document.createElement("article");
    el.className = "wish-card";
    el.dataset.id = w.id;

    const isReserved = !!w.reservedBy;
    const isReservedByMe = w.reservedBy === currentUser.uid;

    let reserveBadge = "";
    if (!isMine && isReservedByMe) {
        reserveBadge = `
            <span class="wish-badge wish-badge-reserved">
                <i class="bx bx-check-shield"></i>
                Reserved by you
            </span>
        `;
    }

    const priorityBadge = `
        <span class="wish-priority wish-priority-${w.priority || "medium"}">
            ${(w.priority || "medium").charAt(0).toUpperCase() + (w.priority || "medium").slice(1)}
        </span>
    `;

    const visibilityBadge = w.visibility === "private"
        ? `<span class="wish-private"><i class="bx bx-lock-alt"></i> Private</span>`
        : "";

    const boughtBadge = w.bought
        ? `<span class="wish-badge wish-badge-bought">
               <i class="bx bx-party"></i>
               ${isMine ? "Received!" : "Bought"}
           </span>`
        : "";

    const priceLine = w.price
        ? `<span class="wish-price">${escapeHTML(w.price)}</span>`
        : "";

    const linkLine = w.url
        ? `<a
               class="wish-link"
               href="${escapeHTML(w.url)}"
               target="_blank"
               rel="noopener noreferrer"
           >
               <i class="bx bx-link-external"></i>
               Open link
           </a>`
        : "";

    const notesLine = w.notes
        ? `<p class="wish-notes">${escapeHTML(w.notes)}</p>`
        : "";

    let actionsHTML = "";

    if (isMine) {
        actionsHTML = `
            <button
                class="wish-delete"
                data-action="delete"
                data-id="${w.id}"
                aria-label="Delete"
            >
                <i class="bx bx-trash"></i>
            </button>
        `;
    } else if (!w.bought) {
        actionsHTML = `
            <button
                class="wish-reserve ${isReservedByMe ? "active" : ""}"
                data-action="reserve"
                data-id="${w.id}"
            >
                <i class="bx ${isReservedByMe ? "bx-x-circle" : "bx-check-shield"}"></i>
                ${isReservedByMe ? "Release" : "I'll get this"}
            </button>
            ${isReservedByMe
                ? `<button
                       class="wish-bought"
                       data-action="bought"
                       data-id="${w.id}"
                   >
                       <i class="bx bx-check"></i>
                       Mark as bought
                   </button>`
                : ""}
        `;
    }

    el.innerHTML = `
        <div class="wish-card-header">
            <div class="wish-badges">
                ${priorityBadge}
                ${visibilityBadge}
                ${boughtBadge}
                ${reserveBadge}
            </div>
        </div>

        <h3 class="wish-title">${escapeHTML(w.title)}</h3>
        ${priceLine}
        ${notesLine}
        ${linkLine}

        <div class="wish-card-actions">${actionsHTML}</div>
    `;

    return el;

}


// ==================== ACTIONS ====================

document.addEventListener("click", async (event) => {

    const btn = event.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "delete") openDeleteModal(id);
    if (action === "reserve") toggleReserve(id);
    if (action === "bought") markBought(id);

});


async function toggleReserve(id) {

    const w = wishes.find((x) => x.id === id);
    if (!w) return;

    try {
        if (w.reservedBy === currentUser.uid) {
            await updateDoc(
                doc(db, "couples", coupleId, "wishlist", id),
                { reservedBy: null, reservedAt: null }
            );
        } else {
            await updateDoc(
                doc(db, "couples", coupleId, "wishlist", id),
                {
                    reservedBy: currentUser.uid,
                    reservedAt: serverTimestamp()
                }
            );
        }
    } catch (error) {
        console.error("Reserve error:", error);
        toastError("Could not reserve.");
    }

}


async function markBought(id) {

    const w = wishes.find((x) => x.id === id);
    if (!w) return;

    const ok = confirm(`Mark "${w.title}" as bought?`);
    if (!ok) return;

    try {
        await updateDoc(
            doc(db, "couples", coupleId, "wishlist", id),
            {
                bought: true,
                boughtAt: serverTimestamp(),
                boughtBy: currentUser.uid
            }
        );
    } catch (error) {
        console.error("Bought error:", error);
        toastError("Could not update.");
    }

}


// ==================== ADD MODAL ====================

function openModal() {
    wishModal.classList.add("show");
    setTimeout(() => {
        document.getElementById("wishTitle").focus();
    }, 100);
}

function closeModal() {
    wishModal.classList.remove("show");
    wishForm.reset();
    const shared = document.querySelector(
        'input[name="wishVisibility"][value="shared"]'
    );
    if (shared) shared.checked = true;
}

openWishModal?.addEventListener("click", openModal);
closeWishModal?.addEventListener("click", closeModal);
cancelWish?.addEventListener("click", closeModal);

wishModal?.addEventListener("click", (event) => {
    if (event.target === wishModal) closeModal();
});


wishForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId || !currentUser) return;

    const title = document.getElementById("wishTitle").value.trim();
    const price = document.getElementById("wishPrice").value.trim();
    const url = document.getElementById("wishUrl").value.trim();
    const notes = document.getElementById("wishNotes").value.trim();
    const priority = document.getElementById("wishPriority").value;

    const visRadio = document.querySelector(
        'input[name="wishVisibility"]:checked'
    );
    const visibility = visRadio ? visRadio.value : "shared";

    if (!title) return;

    try {

        wishSubmit.disabled = true;
        wishSubmit.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        await addDoc(
            collection(db, "couples", coupleId, "wishlist"),
            {
                title,
                price: price || null,
                url: url || null,
                notes: notes || null,
                priority,
                visibility,
                ownerUid: currentUser.uid,
                reservedBy: null,
                reservedAt: null,
                bought: false,
                boughtAt: null,
                boughtBy: null,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        closeModal();

    } catch (error) {
        console.error("Add wish error:", error);
        toastError("Could not save. Please try again.");
    } finally {
        wishSubmit.disabled = false;
        wishSubmit.innerHTML = '<i class="bx bx-gift"></i> Save wish';
    }

});


// ==================== DELETE ====================

function openDeleteModal(id) {
    const w = wishes.find((x) => x.id === id);
    if (!w) return;

    wishToDelete = id;
    deleteWishText.textContent =
        `"${w.title}" will be permanently removed.`;
    deleteWishModal.classList.add("show");
}

function closeDeleteModal() {
    deleteWishModal.classList.remove("show");
    wishToDelete = null;
}

cancelWishDelete?.addEventListener("click", closeDeleteModal);

confirmWishDelete?.addEventListener("click", async () => {
    if (!wishToDelete) return;
    try {
        await deleteDoc(
            doc(db, "couples", coupleId, "wishlist", wishToDelete)
        );
        closeDeleteModal();
    } catch (error) {
        console.error("Delete error:", error);
        closeDeleteModal();
    }
});

deleteWishModal?.addEventListener("click", (event) => {
    if (event.target === deleteWishModal) closeDeleteModal();
});


document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (wishModal?.classList.contains("show")) closeModal();
        if (deleteWishModal?.classList.contains("show")) closeDeleteModal();
    }
});


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
