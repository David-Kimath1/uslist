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

import { logEvent } from "./timeline-logger.js";
import { toastError } from "./toast.js";


let currentUser = null;
let currentUsername = null;
let coupleId = null;
let partnerUid = null;

let sharedItems = [];
let privateItems = [];

let currentFilter = "all";
let itemToDelete = null;
let editingItemId = null;

let memoryCounts = {};   // { itemId: count }
let memoriesUnsubscribe = null;


const bucketList = document.getElementById("bucketList");
const emptyState = document.getElementById("emptyState");
const emptyStateText = document.getElementById("emptyStateText");
const itemCount = document.getElementById("itemCount");

const addModal = document.getElementById("addModal");
const addModalTitle = addModal.querySelector(".modal-header h3");   // NEW
const addModalEyebrow = addModal.querySelector(".modal-header .panel-eyebrow");  // NEW

const openAddModal = document.getElementById("openAddModal");
const emptyAddButton = document.getElementById("emptyAddButton");

const closeAddModal = document.getElementById("closeAddModal");
const cancelAdd = document.getElementById("cancelAdd");

const addItemForm = document.getElementById("addItemForm");
const addItemSubmit = document.getElementById("addItemSubmit");

const filterButtons = document.querySelectorAll(".filter-button");

const deleteModal = document.getElementById("deleteModal");
const deleteText = document.getElementById("deleteText");
const cancelDelete = document.getElementById("cancelDelete");
const confirmDelete = document.getElementById("confirmDelete");


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (!userSnap.exists()) {
        showNotConnectedState();
        return;
    }

    const userData = userSnap.data();
    currentUsername = userData.username || "partner";

    if (!userData.coupleId) {
        showNotConnectedState();
        return;
    }

    coupleId = userData.coupleId;

    const coupleSnap = await getDoc(doc(db, "couples", coupleId));

    if (coupleSnap.exists()) {
        const c = coupleSnap.data();
        partnerUid =
            c.member1Uid === user.uid ? c.member2Uid : c.member1Uid;
    }

    subscribeToItems();
    subscribeToMemories();

});


function subscribeToMemories() {

    if (memoriesUnsubscribe) memoriesUnsubscribe();

    const ref = collection(db, "couples", coupleId, "memories");

    memoriesUnsubscribe = onSnapshot(ref, (snapshot) => {

        memoryCounts = {};

        snapshot.docs.forEach((d) => {
            const m = d.data();
            if (m.linkedItemId) {
                memoryCounts[m.linkedItemId] =
                    (memoryCounts[m.linkedItemId] || 0) + 1;
            }
        });

        renderItems();

    });

}


function showNotConnectedState() {

    bucketList.innerHTML = "";
    itemCount.textContent = "0 items";

    emptyStateText.textContent =
        "You need to connect with your partner first. Head to the Profile page to create or join a couple.";

    emptyState.classList.add("visible");
    openAddModal.disabled = true;
    emptyAddButton.disabled = true;

}


function subscribeToItems() {

    if (sharedUnsubscribe) sharedUnsubscribe();
    if (privateUnsubscribe) privateUnsubscribe();

    const itemsRef = collection(db, "couples", coupleId, "items");

    const sharedQ = query(itemsRef, where("visibility", "==", "shared"));

    sharedUnsubscribe = onSnapshot(sharedQ, (snapshot) => {
        sharedItems = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));
        renderItems();
    });

    const privateQ = query(
        itemsRef,
        where("visibility", "==", "private"),
        where("createdBy", "==", currentUser.uid)
    );

    privateUnsubscribe = onSnapshot(privateQ, (snapshot) => {
        privateItems = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));
        renderItems();
    });

}


let sharedUnsubscribe = null;
let privateUnsubscribe = null;


// ==================== MODAL (ADD + EDIT) ====================

function openModal() {

    editingItemId = null;

    addModalEyebrow.textContent = "NEW ADVENTURE";
    addModalTitle.textContent = "Add to our bucket list";
    addItemSubmit.innerHTML = '<i class="bx bx-plus"></i> Add to list';

    addModal.classList.add("show");

    setTimeout(() => {
        document.getElementById("itemTitle").focus();
    }, 100);

}


function openEditModal(item) {

    editingItemId = item.id;

    addModalEyebrow.textContent = "EDIT ADVENTURE";
    addModalTitle.textContent = "Edit bucket list item";
    addItemSubmit.innerHTML = '<i class="bx bx-check"></i> Save changes';

    // Pre-fill form
    document.getElementById("itemTitle").value = item.title || "";
    document.getElementById("itemDescription").value = item.description || "";

    // Category radio
    const catRadio = document.querySelector(
        `input[name="category"][value="${item.category}"]`
    );
    if (catRadio) catRadio.checked = true;

    // Visibility radio
    const visRadio = document.querySelector(
        `input[name="visibility"][value="${item.visibility}"]`
    );
    if (visRadio) visRadio.checked = true;

    addModal.classList.add("show");

    setTimeout(() => {
        document.getElementById("itemTitle").focus();
    }, 100);

}


function closeModal() {

    addModal.classList.remove("show");
    addItemForm.reset();
    editingItemId = null;

}

openAddModal.addEventListener("click", openModal);
emptyAddButton.addEventListener("click", openModal);
closeAddModal.addEventListener("click", closeModal);
cancelAdd.addEventListener("click", closeModal);

addModal.addEventListener("click", (event) => {
    if (event.target === addModal) closeModal();
});


// ==================== SUBMIT (ADD OR EDIT) ====================

addItemForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId || !currentUser) return;

    const title = document.getElementById("itemTitle").value.trim();
    const description = document.getElementById("itemDescription").value.trim();

    const category = document.querySelector(
        'input[name="category"]:checked'
    ).value;

    const visibility = document.querySelector(
        'input[name="visibility"]:checked'
    ).value;

    if (!title) return;

    const isEditing = !!editingItemId;

    try {

        addItemSubmit.disabled = true;
        addItemSubmit.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        if (isEditing) {

            // ==== UPDATE EXISTING ITEM ====
            await updateDoc(
                doc(db, "couples", coupleId, "items", editingItemId),
                {
                    title,
                    description,
                    category,
                    visibility
                }
            );

        } else {

            // ==== CREATE NEW ITEM ====
            const itemRef = await addDoc(
                collection(db, "couples", coupleId, "items"),
                {
                    title,
                    description,
                    category,
                    visibility,
                    completed: false,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp(),
                    completedAt: null
                }
            );

            if (visibility === "shared") {
                await logEvent("item_added", {
                    title,
                    category,
                    refId: itemRef.id
                });
            }

            if (visibility === "shared" && partnerUid) {
                await addDoc(
                    collection(db, "users", partnerUid, "notifications"),
                    {
                        type: "item_added",
                        fromUid: currentUser.uid,
                        fromUsername: currentUsername,
                        itemId: itemRef.id,
                        itemTitle: title,
                        read: false,
                        createdAt: serverTimestamp()
                    }
                );
            }

        }

        closeModal();

    } catch (error) {

        console.error("Save item error:", error);
        toastError("Could not save item. Please try again.");

    } finally {

        addItemSubmit.disabled = false;

    }

});


// ==================== TOGGLE ====================

async function toggleItem(id) {

    const item = [...sharedItems, ...privateItems].find((i) => i.id === id);
    if (!item) return;

    const completed = !item.completed;

    try {

        await updateDoc(
            doc(db, "couples", coupleId, "items", id),
            {
                completed,
                completedAt: completed ? serverTimestamp() : null
            }
        );

        if (completed && item.visibility === "shared") {
            await logEvent("item_completed", {
                title: item.title,
                category: item.category,
                refId: id
            });
        }

    } catch (error) {

        console.error("Toggle error:", error);

    }

}


// ==================== DELETE ====================

function openDeleteModal(id) {

    const item = [...sharedItems, ...privateItems].find((i) => i.id === id);
    if (!item) return;

    itemToDelete = id;
    deleteText.textContent =
        `"${item.title}" will be permanently removed.`;
    deleteModal.classList.add("show");

}

function closeDeleteModal() {
    deleteModal.classList.remove("show");
    itemToDelete = null;
}

cancelDelete.addEventListener("click", closeDeleteModal);

confirmDelete.addEventListener("click", async () => {

    if (!itemToDelete) return;

    try {
        await deleteDoc(
            doc(db, "couples", coupleId, "items", itemToDelete)
        );
        closeDeleteModal();
    } catch (error) {
        console.error("Delete error:", error);
        closeDeleteModal();
    }

});

deleteModal.addEventListener("click", (event) => {
    if (event.target === deleteModal) closeDeleteModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (deleteModal.classList.contains("show")) closeDeleteModal();
        if (addModal.classList.contains("show")) closeModal();
    }
});


// ==================== FILTERS ====================

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        currentFilter = button.dataset.filter;
        renderItems();
    });
});


// ==================== RENDER ====================

function renderItems() {

    const allItems = [...sharedItems];

    for (const p of privateItems) {
        if (!allItems.find((i) => i.id === p.id)) {
            allItems.push(p);
        }
    }

    allItems.sort((a, b) => {
        const aT = a.createdAt?.seconds ?? 0;
        const bT = b.createdAt?.seconds ?? 0;
        return bT - aT;
    });

    let filteredItems = allItems;

    if (currentFilter === "active") {
        filteredItems = allItems.filter((i) => !i.completed);
    }
    if (currentFilter === "completed") {
        filteredItems = allItems.filter((i) => i.completed);
    }
    if (currentFilter === "private") {
        filteredItems = allItems.filter((i) => i.visibility === "private");
    }

    bucketList.innerHTML = "";

    itemCount.textContent =
        `${filteredItems.length} ${
            filteredItems.length === 1 ? "item" : "items"
        }`;

    if (filteredItems.length === 0) {
        emptyState.classList.add("visible");
        return;
    }

    emptyState.classList.remove("visible");

    filteredItems.forEach((item) => {
        bucketList.appendChild(createItemElement(item));
    });

}


function createItemElement(item) {

    const article = document.createElement("article");
    const isPrivate = item.visibility === "private";

    article.className =
        `bucket-item ${item.completed ? "completed" : ""} ${
            isPrivate ? "is-private" : ""
        }`;

    article.innerHTML = `
        <button
            class="item-checkbox"
            aria-label="Mark item as complete"
            data-action="toggle"
            data-id="${item.id}"
        >
            <i class="bx bx-check"></i>
        </button>

        <div class="item-main">
            <div class="item-top">
                <span class="item-category">
                    ${escapeHTML(item.category)}
                </span>
                ${
                    isPrivate
                        ? `<span class="item-private-badge">
                              <i class="bx bx-lock-alt"></i>
                              Private
                           </span>`
                        : ""
                }
            </div>

            <h3>${escapeHTML(item.title)}</h3>

            ${
                item.description
                    ? `<p>${escapeHTML(item.description)}</p>`
                    : ""
            }

            ${
                memoryCounts[item.id]
                    ? `<span class="item-memory-badge">
                          <i class="bx bx-image"></i>
                          ${memoryCounts[item.id]} ${
                              memoryCounts[item.id] === 1
                                  ? "memory"
                                  : "memories"
                          }
                       </span>`
                    : ""
            }

            <span class="item-date">
                <i class="bx bx-calendar"></i>
                Added ${formatDate(item.createdAt)}
            </span>
        </div>

        <button
            class="item-edit"
            aria-label="Edit item"
            data-action="edit"
            data-id="${item.id}"
        >
            <i class="bx bx-pencil"></i>
        </button>

        <button
            class="item-delete"
            aria-label="Delete item"
            data-action="delete"
            data-id="${item.id}"
        >
            <i class="bx bx-trash"></i>
        </button>
    `;

    return article;

}


// ==================== CLICK HANDLER ====================

bucketList.addEventListener("click", (event) => {

    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "toggle") toggleItem(id);
    if (action === "delete") openDeleteModal(id);

    if (action === "edit") {
        const item = [...sharedItems, ...privateItems].find((i) => i.id === id);
        if (item) openEditModal(item);
    }

});


// ==================== HELPERS ====================

function formatDate(createdAt) {

    if (!createdAt) return "just now";

    let date;

    if (createdAt.toDate) date = createdAt.toDate();
    else if (createdAt.seconds) date = new Date(createdAt.seconds * 1000);
    else date = new Date(createdAt);

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
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

menuButton.addEventListener("click", () => sidebar.classList.add("open"));
sidebarClose.addEventListener("click", () => sidebar.classList.remove("open"));

document.addEventListener("click", (event) => {
    if (
        window.innerWidth <= 850 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        !menuButton.contains(event.target)
    ) {
        sidebar.classList.remove("open");
    }
});
