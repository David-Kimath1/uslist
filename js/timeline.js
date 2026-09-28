import { auth, db } from "../firebase/config.js";

import {
import { toastError } from "./toast.js";
    doc,
    getDoc,
    deleteDoc,
    collection,
    onSnapshot,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


let currentUser = null;
let coupleId = null;
let events = [];
let currentFilter = "all";
let unsubscribe = null;
let eventToDelete = null;


const feed = document.getElementById("timelineFeed");
const emptyState = document.getElementById("timelineEmptyState");
const timelineCount = document.getElementById("timelineCount");
const filterButtons = document.querySelectorAll(
    ".timeline-toolbar .filter-button"
);

const deleteEventModal = document.getElementById("deleteEventModal");
const deleteEventText = document.getElementById("deleteEventText");
const cancelEventDelete = document.getElementById("cancelEventDelete");
const confirmEventDelete = document.getElementById("confirmEventDelete");


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
    subscribeToTimeline();

});


function subscribeToTimeline() {

    if (unsubscribe) unsubscribe();

    const ref = query(
        collection(db, "couples", coupleId, "timeline"),
        orderBy("createdAt", "desc"),
        limit(200)
    );

    unsubscribe = onSnapshot(ref, (snapshot) => {

        events = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        renderTimeline();

    });

}


filterButtons.forEach((button) => {
    button.addEventListener("click", () => {

        filterButtons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");

        currentFilter = button.dataset.filter;
        renderTimeline();

    });
});


function renderTimeline() {

    let filtered = events;

    if (currentFilter === "items") {
        filtered = events.filter(
            (e) => e.type === "item_added" || e.type === "item_completed"
        );
    }

    if (currentFilter === "memories") {
        filtered = events.filter((e) => e.type === "memory_added");
    }

    if (currentFilter === "dates") {
        filtered = events.filter((e) => e.type === "date_added");
    }

    timelineCount.textContent =
        `${filtered.length} ${
            filtered.length === 1 ? "event" : "events"
        }`;

    feed.innerHTML = "";

    if (filtered.length === 0) {
        emptyState.classList.add("visible");
        return;
    }

    emptyState.classList.remove("visible");

    let currentHeader = null;

    filtered.forEach((event) => {

        const header = headerFor(event.createdAt);

        if (header !== currentHeader) {
            currentHeader = header;

            const headerEl = document.createElement("div");
            headerEl.className = "timeline-day-header";
            headerEl.textContent = header;
            feed.appendChild(headerEl);
        }

        feed.appendChild(createEventElement(event));

    });

}


function headerFor(timestamp) {

    if (!timestamp) return "Recently";

    let date;

    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);

    const now = new Date();

    const startOfToday = new Date(
        now.getFullYear(), now.getMonth(), now.getDate()
    );

    const startOfYesterday = new Date(
        startOfToday.getTime() - 86400000
    );

    const startOfDay = new Date(
        date.getFullYear(), date.getMonth(), date.getDate()
    );

    if (startOfDay.getTime() === startOfToday.getTime()) {
        return "Today";
    }

    if (startOfDay.getTime() === startOfYesterday.getTime()) {
        return "Yesterday";
    }

    const isSameYear = date.getFullYear() === now.getFullYear();

    const day = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: "short" });

    if (isSameYear) {
        return `${day} ${month}`;
    }

    return `${day} ${month} ${date.getFullYear()}`;

}


function createEventElement(event) {

    const { icon } = iconFor(event.type);

    const el = document.createElement("article");
    el.className = "timeline-event";

    const canDelete =
        currentUser && event.actorUid === currentUser.uid;

    el.innerHTML = `
        <div class="timeline-event-icon">
            <i class="bx ${icon}"></i>
        </div>

        <div class="timeline-event-body">
            <p class="timeline-event-text">
                ${describe(event)}
            </p>
            <span class="timeline-event-time">
                ${timeAgo(event.createdAt)}
            </span>
        </div>

        ${
            canDelete
                ? `<button
                       class="timeline-event-delete"
                       data-action="delete"
                       data-id="${event.id}"
                       aria-label="Delete"
                   >
                       <i class="bx bx-trash"></i>
                   </button>`
                : ""
        }
    `;

    return el;

}


feed.addEventListener("click", (event) => {

    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "delete") {
        openDeleteModal(button.dataset.id);
    }

});


function openDeleteModal(eventId) {

    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;

    if (!currentUser || ev.actorUid !== currentUser.uid) {
        return;
    }

    eventToDelete = eventId;

    if (deleteEventText) {
        deleteEventText.textContent =
            buildDeleteMessage(ev);
    }

    deleteEventModal?.classList.add("show");

}


function buildDeleteMessage(ev) {

    const title = ev.data?.title || "this item";

    switch (ev.type) {
        case "item_added":
            return `"${title}" will be removed from your Bucket List and from Your Story.`;
        case "item_completed":
            return `"${title}" will be removed from your Bucket List and from Your Story.`;
        case "memory_added":
            return `"${title}" will be permanently removed from Memories and from Your Story.`;
        case "date_added":
            return `"${title}" will be removed from Our Dates and from Your Story.`;
        default:
            return "This event will be removed from Your Story.";
    }

}


function closeDeleteModal() {
    deleteEventModal?.classList.remove("show");
    eventToDelete = null;
}


cancelEventDelete?.addEventListener("click", closeDeleteModal);


confirmEventDelete?.addEventListener("click", async () => {

    if (!eventToDelete) return;

    const ev = events.find((e) => e.id === eventToDelete);
    if (!ev) {
        closeDeleteModal();
        return;
    }

    try {

        // 1) Delete the source doc (if we know its collection + refId)
        if (ev.data?.refId) {

            let subcollection = null;

            if (ev.type === "item_added" || ev.type === "item_completed") {
                subcollection = "items";
            } else if (ev.type === "memory_added") {
                subcollection = "memories";
            } else if (ev.type === "date_added") {
                subcollection = "dates";
            }

            if (subcollection) {
                try {
                    await deleteDoc(
                        doc(
                            db,
                            "couples",
                            coupleId,
                            subcollection,
                            ev.data.refId
                        )
                    );
                } catch (error) {
                    // Source might already be gone — continue
                    console.warn("Source delete failed:", error);
                }
            }

        }

        // 2) Delete the timeline event itself
        await deleteDoc(
            doc(db, "couples", coupleId, "timeline", eventToDelete)
        );

        closeDeleteModal();

    } catch (error) {

        console.error("Delete event error:", error);
        toastError("Could not delete. Please try again.");
        closeDeleteModal();

    }

});


deleteEventModal?.addEventListener("click", (event) => {
    if (event.target === deleteEventModal) closeDeleteModal();
});


document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && deleteEventModal?.classList.contains("show")) {
        closeDeleteModal();
    }
});


function iconFor(type) {

    switch (type) {
        case "item_added":      return { icon: "bx-plus-circle" };
        case "item_completed":  return { icon: "bx-check-circle" };
        case "memory_added":    return { icon: "bx-image-add" };
        case "date_added":      return { icon: "bx-calendar-plus" };
        default:                return { icon: "bx-circle" };
    }

}


function describe(event) {

    const who = `<strong>@${escapeHTML(event.actorUsername || "partner")}</strong>`;
    const title = `<strong>${escapeHTML(event.data?.title || "")}</strong>`;

    if (event.type === "item_completed") {
        return `${who} completed ${title}`;
    }

    if (event.type === "memory_added") {
        return `${who} added a memory: ${title}`;
    }

    if (event.type === "date_added") {
        return `${who} added a date: ${title}`;
    }

    return `${who} added ${title} to the bucket list`;

}


function timeAgo(timestamp) {

    if (!timestamp) return "";

    let date;

    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);

    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

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


function showEmpty(message) {

    feed.innerHTML = "";
    timelineCount.textContent = "0 events";

    const p = emptyState.querySelector("p");
    if (p) p.textContent = message;

    emptyState.classList.add("visible");

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
