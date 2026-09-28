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
import { toastError } from "./toast.js";


// ==================== STATE ====================

let currentUser = null;
let currentUsername = null;
let coupleId = null;
let partnerUid = null;

let notes = [];
let currentFilter = "all";

let noteToDelete = null;
let editingNoteId = null;
let readingNoteId = null;

let unsubscribe = null;


// ==================== ELEMENTS ====================

const notesGrid = document.getElementById("notesGrid");
const notesEmptyState = document.getElementById("notesEmptyState");
const notesCount = document.getElementById("notesCount");
const filterButtons = document.querySelectorAll(
    ".notes-toolbar .filter-button"
);

const noteModal = document.getElementById("noteModal");
const noteModalEyebrow = document.getElementById("noteModalEyebrow");
const noteModalTitle = document.getElementById("noteModalTitle");
const openNoteModal = document.getElementById("openNoteModal");
const emptyNoteButton = document.getElementById("emptyNoteButton");
const closeNoteModal = document.getElementById("closeNoteModal");
const cancelNote = document.getElementById("cancelNote");
const noteForm = document.getElementById("noteForm");
const noteSubmit = document.getElementById("noteSubmit");

const readerModal = document.getElementById("readerModal");
const readerCategory = document.getElementById("readerCategory");
const readerByline = document.getElementById("readerByline");
const readerTitle = document.getElementById("readerTitle");
const readerBody = document.getElementById("readerBody");
const readerActions = document.getElementById("readerActions");
const closeReader = document.getElementById("closeReader");

const deleteNoteModal = document.getElementById("deleteNoteModal");
const deleteNoteText = document.getElementById("deleteNoteText");
const cancelNoteDelete = document.getElementById("cancelNoteDelete");
const confirmNoteDelete = document.getElementById("confirmNoteDelete");


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

    subscribeToNotes();

});


function subscribeToNotes() {

    if (unsubscribe) unsubscribe();

    const ref = query(
        collection(db, "couples", coupleId, "notes"),
        orderBy("createdAt", "desc")
    );

    unsubscribe = onSnapshot(ref, (snap) => {

        notes = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        render();

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


// ==================== RENDER ====================

function render() {

    let filtered = notes;

    if (currentFilter !== "all") {
        filtered = notes.filter((n) => n.category === currentFilter);
    }

    notesGrid.innerHTML = "";

    notesCount.textContent =
        `${filtered.length} ${
            filtered.length === 1 ? "note" : "notes"
        }`;

    if (filtered.length === 0) {
        notesEmptyState.classList.add("visible");
        return;
    }

    notesEmptyState.classList.remove("visible");

    filtered.forEach((n) => {
        notesGrid.appendChild(createNoteCard(n));
    });

}


function createNoteCard(note) {

    const el = document.createElement("article");
    el.className = "note-card";
    el.dataset.id = note.id;

    const preview = buildPreview(note.body, 160);
    const isMine = note.createdBy === currentUser.uid;

    el.innerHTML = `
        <div class="note-card-top">
            <span class="note-category">
                ${formatCategory(note.category)}
            </span>

            ${isMine
                ? `<span class="note-mine">You</span>`
                : `<span class="note-theirs">Partner</span>`}
        </div>

        <h3 class="note-card-title">
            ${escapeHTML(note.title)}
        </h3>

        <p class="note-card-preview">
            ${escapeHTML(preview)}
        </p>

        <div class="note-card-footer">
            <span class="note-date">
                <i class="bx bx-calendar"></i>
                ${formatDate(note.createdAt)}
            </span>
        </div>
    `;

    el.addEventListener("click", () => openReader(note));

    return el;

}


function buildPreview(body, max) {

    if (!body) return "";

    const clean = body.replace(/\s+/g, " ").trim();

    if (clean.length <= max) return clean;

    return clean.slice(0, max).trim() + "…";

}


// ==================== WRITE / EDIT MODAL ====================

function openModal() {

    editingNoteId = null;

    noteModalEyebrow.textContent = "NEW NOTE";
    noteModalTitle.textContent = "Write a note";
    noteSubmit.innerHTML = '<i class="bx bx-check"></i> Save note';

    noteModal.classList.add("show");

    setTimeout(() => {
        document.getElementById("noteTitle").focus();
    }, 100);

}


function openEditModal(note) {

    editingNoteId = note.id;

    noteModalEyebrow.textContent = "EDIT NOTE";
    noteModalTitle.textContent = "Update your note";
    noteSubmit.innerHTML = '<i class="bx bx-check"></i> Save changes';

    document.getElementById("noteTitle").value = note.title || "";
    document.getElementById("noteBody").value = note.body || "";

    const cat = document.querySelector(
        `input[name="noteCategory"][value="${note.category}"]`
    );
    if (cat) cat.checked = true;

    noteModal.classList.add("show");

    setTimeout(() => {
        document.getElementById("noteTitle").focus();
    }, 100);

}


function closeModal() {

    noteModal.classList.remove("show");
    noteForm.reset();
    editingNoteId = null;

}


openNoteModal?.addEventListener("click", openModal);
emptyNoteButton?.addEventListener("click", openModal);
closeNoteModal?.addEventListener("click", closeModal);
cancelNote?.addEventListener("click", closeModal);

noteModal?.addEventListener("click", (event) => {
    if (event.target === noteModal) closeModal();
});


noteForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId || !currentUser) return;

    const title = document.getElementById("noteTitle").value.trim();
    const body = document.getElementById("noteBody").value.trim();

    const catRadio = document.querySelector(
        'input[name="noteCategory"]:checked'
    );
    const category = catRadio ? catRadio.value : "note";

    if (!title || !body) return;

    const isEditing = !!editingNoteId;

    try {

        noteSubmit.disabled = true;
        noteSubmit.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        if (isEditing) {

            await updateDoc(
                doc(db, "couples", coupleId, "notes", editingNoteId),
                {
                    title,
                    body,
                    category,
                    updatedAt: serverTimestamp()
                }
            );

        } else {

            await addDoc(
                collection(db, "couples", coupleId, "notes"),
                {
                    title,
                    body,
                    category,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: null
                }
            );

            await logEvent("note_added", {
                title,
                category
            });

        }

        closeModal();

    } catch (error) {

        console.error("Save note error:", error);
        toastError("Could not save note. Please try again.");

    } finally {

        noteSubmit.disabled = false;
        noteSubmit.innerHTML =
            '<i class="bx bx-check"></i> Save note';

    }

});


// ==================== READER ====================

function openReader(note) {

    readingNoteId = note.id;

    readerCategory.textContent = formatCategory(note.category);

    const isMine = note.createdBy === currentUser.uid;
    const who = isMine ? "You" : "Partner";
    const when = formatDate(note.createdAt);

    readerByline.textContent = `By ${who} · ${when}`;

    readerTitle.textContent = note.title;
    readerBody.textContent = note.body;

    // Actions — only author can edit/delete
    readerActions.innerHTML = "";

    if (isMine) {
        const editBtn = document.createElement("button");
        editBtn.className = "secondary-button";
        editBtn.innerHTML = '<i class="bx bx-pencil"></i> Edit';
        editBtn.addEventListener("click", () => {
            closeReaderFn();
            openEditModal(note);
        });
        readerActions.appendChild(editBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "danger-button";
        delBtn.innerHTML = '<i class="bx bx-trash"></i> Delete';
        delBtn.addEventListener("click", () => {
            closeReaderFn();
            openDeleteModal(note.id);
        });
        readerActions.appendChild(delBtn);
    }

    readerModal.classList.add("show");

}


function closeReaderFn() {
    readerModal.classList.remove("show");
    readingNoteId = null;
}

closeReader?.addEventListener("click", closeReaderFn);

readerModal?.addEventListener("click", (event) => {
    if (event.target === readerModal) closeReaderFn();
});


// ==================== DELETE ====================

function openDeleteModal(id) {

    const note = notes.find((n) => n.id === id);
    if (!note) return;

    noteToDelete = id;
    deleteNoteText.textContent =
        `"${note.title}" will be permanently removed.`;
    deleteNoteModal.classList.add("show");

}

function closeDeleteModal() {
    deleteNoteModal.classList.remove("show");
    noteToDelete = null;
}

cancelNoteDelete?.addEventListener("click", closeDeleteModal);

confirmNoteDelete?.addEventListener("click", async () => {

    if (!noteToDelete) return;

    try {
        await deleteDoc(
            doc(db, "couples", coupleId, "notes", noteToDelete)
        );
        closeDeleteModal();
    } catch (error) {
        console.error("Delete note error:", error);
        closeDeleteModal();
    }

});

deleteNoteModal?.addEventListener("click", (event) => {
    if (event.target === deleteNoteModal) closeDeleteModal();
});


// ==================== ESC ====================

document.addEventListener("keydown", (event) => {

    if (event.key !== "Escape") return;

    if (noteModal?.classList.contains("show")) closeModal();
    if (deleteNoteModal?.classList.contains("show")) closeDeleteModal();
    if (readerModal?.classList.contains("show")) closeReaderFn();

});


// ==================== HELPERS ====================

function formatCategory(category) {

    const map = {
        note: "Note",
        letter: "Letter",
        memory: "Memory",
        thought: "Thought"
    };

    return map[category] || "Note";

}


function formatDate(timestamp) {

    if (!timestamp) return "just now";

    let date;

    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);

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
