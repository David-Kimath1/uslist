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
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { logEvent } from "./timeline-logger.js";
import { toastError } from "./toast.js";


let currentUser = null;
let coupleId = null;
let memories = [];
let bucketItems = [];
let currentFilter = "all";
let memoryToDelete = null;

let unsubscribe = null;
let itemsUnsubscribe = null;


const memoriesGrid = document.getElementById("memoriesGrid");
const memoryEmptyState = document.getElementById("memoryEmptyState");
const memoryCount = document.getElementById("memoryCount");

const memoryModal = document.getElementById("memoryModal");
const openMemoryModal = document.getElementById("openMemoryModal");
const emptyMemoryButton = document.getElementById("emptyMemoryButton");
const closeMemoryModal = document.getElementById("closeMemoryModal");
const cancelMemory = document.getElementById("cancelMemory");
const memoryForm = document.getElementById("memoryForm");
const memoryLinkedItem = document.getElementById("memoryLinkedItem");

const deleteMemoryModal = document.getElementById("deleteMemoryModal");
const deleteMemoryText = document.getElementById("deleteMemoryText");
const cancelMemoryDelete = document.getElementById("cancelMemoryDelete");
const confirmMemoryDelete = document.getElementById("confirmMemoryDelete");

const filterButtons = document.querySelectorAll(
    ".memory-toolbar .filter-button"
);

const menuButton = document.getElementById("menuButton");
const sidebar = document.getElementById("sidebar");
const sidebarClose = document.getElementById("sidebarClose");


// ==================== BOOTSTRAP ====================

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();

    if (!userData.coupleId) {
        showEmptyState("Connect with your partner first.");
        return;
    }

    coupleId = userData.coupleId;

    subscribeToMemories();
    subscribeToBucketItems();

});


function subscribeToMemories() {

    if (unsubscribe) unsubscribe();

    const ref = query(
        collection(db, "couples", coupleId, "memories"),
        orderBy("createdAt", "desc")
    );

    unsubscribe = onSnapshot(ref, (snapshot) => {

        memories = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        renderMemories();
        populateItemDropdown();

    });

}


function subscribeToBucketItems() {

    if (itemsUnsubscribe) itemsUnsubscribe();

    const ref = query(
        collection(db, "couples", coupleId, "items"),
        where("visibility", "==", "shared")
    );

    itemsUnsubscribe = onSnapshot(ref, (snapshot) => {

        bucketItems = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        populateItemDropdown();

    });

}


// ==================== DROPDOWN ====================

function populateItemDropdown() {

    if (!memoryLinkedItem) return;

    const current = memoryLinkedItem.value;

    memoryLinkedItem.innerHTML =
        '<option value="">— None —</option>';

    const sorted = [...bucketItems].sort(
        (a, b) => a.title.localeCompare(b.title)
    );

    sorted.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.title;
        memoryLinkedItem.appendChild(opt);
    });

    // Restore previous selection if still valid
    if (current) {
        memoryLinkedItem.value = current;
    }

}


// ==================== MODAL ====================

function openModal() {

    memoryModal.classList.add("show");

    setTimeout(() => {
        document.getElementById("memoryTitle").focus();
    }, 100);

}

function closeModal() {

    memoryModal.classList.remove("show");
    memoryForm.reset();

    const romance = document.querySelector(
        'input[name="memoryCategory"][value="romance"]'
    );
    if (romance) romance.checked = true;

}

openMemoryModal?.addEventListener("click", openModal);
emptyMemoryButton?.addEventListener("click", openModal);
closeMemoryModal?.addEventListener("click", closeModal);
cancelMemory?.addEventListener("click", closeModal);

memoryModal?.addEventListener("click", (event) => {
    if (event.target === memoryModal) closeModal();
});


// ==================== SAVE ====================

memoryForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId || !currentUser) return;

    const title = document.getElementById("memoryTitle").value.trim();
    const date = document.getElementById("memoryDate").value;
    const description = document.getElementById("memoryDescription").value.trim();

    const selectedCategory = document.querySelector(
        'input[name="memoryCategory"]:checked'
    );
    const category = selectedCategory ? selectedCategory.value : "romance";

    const linkedItemId = memoryLinkedItem
        ? (memoryLinkedItem.value || null)
        : null;

    if (!title || !date) return;

    try {

        const submitBtn = memoryForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        await addDoc(
            collection(db, "couples", coupleId, "memories"),
            {
                title,
                date,
                description,
                category,
                linkedItemId,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        await logEvent("memory_added", {
            title,
            category,
            date,
            linkedItemId
        });

        closeModal();

    } catch (error) {

        console.error("Add memory error:", error);
        toastError("Could not save memory.");

    } finally {

        const submitBtn = memoryForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bx bx-heart"></i> Save Memory';
        }

    }

});


// ==================== FILTERS ====================

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {

        const filter = button.dataset.filter;
        if (!filter) return;

        currentFilter = filter;

        filterButtons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");

        renderMemories();

    });
});


// ==================== RENDER ====================

function renderMemories() {

    if (!memoriesGrid) return;

    let filtered = memories;

    if (currentFilter !== "all") {
        filtered = memories.filter((m) => m.category === currentFilter);
    }

    memoriesGrid.innerHTML = "";

    memoryCount.textContent =
        `${filtered.length} ${
            filtered.length === 1 ? "memory" : "memories"
        }`;

    if (filtered.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();

    filtered.forEach((memory) => {
        memoriesGrid.appendChild(createMemoryCard(memory));
    });

}


function createMemoryCard(memory) {

    const article = document.createElement("article");
    article.className = "memory-card";

    // Find linked item title
    const linked = memory.linkedItemId
        ? bucketItems.find((i) => i.id === memory.linkedItemId)
        : null;

    article.innerHTML = `
        <div class="memory-cover">
            <div class="memory-cover-icon">
                <i class="bx bx-heart"></i>
            </div>
        </div>

        <div class="memory-content">
            <div class="memory-top">
                <span class="memory-category">
                    ${formatCategory(memory.category)}
                </span>

                <button
                    type="button"
                    class="memory-delete"
                    data-action="delete"
                    data-id="${memory.id}"
                    aria-label="Delete memory"
                >
                    <i class="bx bx-trash"></i>
                </button>
            </div>

            <h3>${escapeHTML(memory.title)}</h3>

            <span class="memory-date">
                <i class="bx bx-calendar"></i>
                ${formatDate(memory.date)}
            </span>

            ${
                linked
                    ? `<a
                          class="memory-linked-chip"
                          href="bucket-list.html"
                       >
                          <i class="bx bx-list-check"></i>
                          ${escapeHTML(linked.title)}
                       </a>`
                    : ""
            }

            ${
                memory.description
                    ? `<p>${escapeHTML(memory.description)}</p>`
                    : ""
            }
        </div>
    `;

    return article;

}


memoriesGrid?.addEventListener("click", (event) => {

    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "delete") {
        deleteMemory(button.dataset.id);
    }

});


// ==================== EMPTY STATE ====================

function showEmptyState(customMessage) {

    if (!memoryEmptyState) return;

    const title = memoryEmptyState.querySelector("h3");
    const text = memoryEmptyState.querySelector("p");

    if (customMessage) {
        if (title) title.textContent = "Nothing to show";
        if (text) text.textContent = customMessage;
    } else if (currentFilter === "all") {
        if (title) title.textContent = "No memories yet";
        if (text) text.textContent =
            "Start saving the moments that make your relationship special.";
    } else {
        const cat = formatCategory(currentFilter);
        if (title) title.textContent = `No ${cat.toLowerCase()} memories`;
        if (text) text.textContent =
            `Memories you add to ${cat.toLowerCase()} will appear here.`;
    }

    memoryEmptyState.classList.add("visible");

}


function hideEmptyState() {
    if (!memoryEmptyState) return;
    memoryEmptyState.classList.remove("visible");
}


// ==================== DELETE ====================

function deleteMemory(id) {

    const memory = memories.find((m) => m.id === id);
    if (!memory) return;

    memoryToDelete = id;

    if (deleteMemoryText) {
        deleteMemoryText.textContent =
            `"${memory.title}" will be permanently removed.`;
    }

    deleteMemoryModal?.classList.add("show");

}

function closeDeleteModal() {
    deleteMemoryModal?.classList.remove("show");
    memoryToDelete = null;
}

cancelMemoryDelete?.addEventListener("click", closeDeleteModal);

confirmMemoryDelete?.addEventListener("click", async () => {

    if (!memoryToDelete) return;

    try {
        await deleteDoc(
            doc(db, "couples", coupleId, "memories", memoryToDelete)
        );
        closeDeleteModal();
    } catch (error) {
        console.error("Delete memory error:", error);
        closeDeleteModal();
    }

});

deleteMemoryModal?.addEventListener("click", (event) => {
    if (event.target === deleteMemoryModal) closeDeleteModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (memoryModal?.classList.contains("show")) closeModal();
    if (deleteMemoryModal?.classList.contains("show")) closeDeleteModal();
});


// ==================== HELPERS ====================

function formatCategory(category) {

    const map = {
        romance: "Romance",
        travel: "Travel",
        dates: "Dates",
        milestones: "Milestones"
    };

    return map[category] || "Memory";

}


function formatDate(dateString) {

    if (!dateString) return "";

    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

}


function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


// ==================== MOBILE SIDEBAR ====================

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
