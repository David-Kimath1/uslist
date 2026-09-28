import { auth, db } from "../firebase/config.js";

import {
    showPush,
    buildPushPrompt,
    pushPermission
} from "./push-notify.js";

import { showBanner } from "./notify-banner.js";

import {
    doc,
    collection,
    updateDoc,
    onSnapshot,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ==================== STATE ====================

let currentUser = null;
let notifications = [];
let notifUnsubscribe = null;
let wired = false;


// ==================== INJECT BELL ====================


function injectBell() {

    // === BELL DISABLED ===
    // The bell + dropdown are hidden by design.
    // Notifications appear as slide-in banners instead.
    return null;
    // === END BELL DISABLED ===

    const headerActions =
        document.querySelector(".header-actions");

    if (!headerActions) return null;

    const existing =
        headerActions.querySelector(".notification-wrapper");

    if (existing) return existing;


    const wrapper = document.createElement("div");
    wrapper.className = "notification-wrapper";

    wrapper.innerHTML = `
        <button
            class="icon-button notification-bell"
            id="notificationBell"
            aria-label="Notifications"
            type="button"
        >
            <i class="bx bx-bell"></i>
        </button>

        <div
            class="notification-panel"
            id="notificationPanel"
            hidden
        >
            <div class="notification-panel-header">
                <strong>Notifications</strong>

                <button
                    class="notification-mark-all"
                    id="markAllRead"
                    type="button"
                >
                    Mark all read
                </button>
            </div>

            <div
                class="notification-list"
                id="notificationList"
            ></div>

            <div
                class="notification-empty"
                id="notificationEmpty"
                hidden
            >
                <i class="bx bx-bell-off"></i>
                <p>No notifications yet</p>
            </div>
        </div>
    `;

    headerActions.insertBefore(
        wrapper,
        headerActions.firstChild
    );

    return wrapper;

}



// ==================== BOOTSTRAP ====================

auth.onAuthStateChanged((user) => {

    if (!user) return;

    currentUser = user;

    // Bell may be disabled, but we still want the banner + push
    // to work. So inject (or skip), then always subscribe.
    injectBell();

    if (!wired) {
        wireUpUI();
        wired = true;

        // Show push prompt if user hasn't decided yet
        if (pushPermission() === "default") {
            setTimeout(() => {
                buildPushPrompt(() => {
                    console.log("Push notifications enabled");
                });
            }, 3000);
        }
    }

    subscribeToNotifications();

});


// ==================== SUBSCRIBE ====================

function subscribeToNotifications() {

    if (notifUnsubscribe) notifUnsubscribe();

    const notifRef = collection(
        db,
        "users",
        currentUser.uid,
        "notifications"
    );

    // Track which notifications we've already shown a banner for.
    // Uses sessionStorage so it survives page navigation in the same tab.
    const SHOWN_KEY = "uslist_shown_notifications";
    let shownIds = new Set();
    try {
        const saved = sessionStorage.getItem(SHOWN_KEY);
        if (saved) shownIds = new Set(JSON.parse(saved));
    } catch (e) {}

    // On the first snapshot of this page load, mark all existing
    // notifications as "already shown". Only brand-new ones that arrive
    // AFTER this first snapshot will trigger a banner.
    let firstLoad = true;

    notifUnsubscribe = onSnapshot(notifRef, (snapshot) => {

        notifications = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
                const aT = a.createdAt?.seconds ?? 0;
                const bT = b.createdAt?.seconds ?? 0;
                return bT - aT;
            });

        if (firstLoad) {
            // Seed the "already shown" set with everything on initial load
            notifications.forEach((n) => shownIds.add(n.id));
            persistShown(shownIds);
            firstLoad = false;
            renderNotifications();
            return;
        }

        // Only fire for notifications that arrived since last snapshot
        notifications.forEach((n) => {
            if (!shownIds.has(n.id) && !n.read) {
                shownIds.add(n.id);
                persistShown(shownIds);
                firePush(n);
            }
        });

        renderNotifications();

    });

    function persistShown(set) {
        try {
            sessionStorage.setItem(
                SHOWN_KEY,
                JSON.stringify([...set].slice(-200))
            );
        } catch (e) {}
    }

}


// ==================== UI WIRING ====================

function wireUpUI() {

    const bell = document.getElementById("notificationBell");
    const panel = document.getElementById("notificationPanel");
    const markAllBtn = document.getElementById("markAllRead");

    if (!bell || !panel || !markAllBtn) return;


    bell.addEventListener("click", (event) => {
        event.stopPropagation();
        panel.hidden = !panel.hidden;
    });


    document.addEventListener("click", (event) => {
        if (
            !panel.hidden &&
            !panel.contains(event.target) &&
            !bell.contains(event.target)
        ) {
            panel.hidden = true;
        }
    });


    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            panel.hidden = true;
        }
    });


    markAllBtn.addEventListener("click", async (event) => {

        event.stopPropagation();

        const unread = notifications.filter((n) => !n.read);

        if (unread.length === 0) return;

        try {
            const batch = writeBatch(db);

            unread.forEach((n) => {
                batch.update(
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "notifications",
                        n.id
                    ),
                    { read: true }
                );
            });

            await batch.commit();
        } catch (error) {
            console.error("Mark all read error:", error);
        }

    });

}


// ==================== RENDER ====================

function describeNotification(n) {

    const who = `<strong>@${escapeHTML(n.fromUsername || "partner")}</strong>`;
    const title = `<strong>${escapeHTML(n.itemTitle || "")}</strong>`;

    switch (n.type) {
        case "item_added":
            return `${who} added a new bucket list item: ${title}`;

        case "date_reminder_week":
            return `${title} is in one week`;

        case "date_reminder_today":
            return `${title} is today`;

        case "cycle_started":
            return `${who} logged a new cycle: ${title}`;

        default:
            return `${who} did something new: ${title}`;
    }

}

function renderNotifications() {

    const list = document.getElementById("notificationList");
    const empty = document.getElementById("notificationEmpty");

    if (!list || !empty) return;


    list.innerHTML = "";


    if (notifications.length === 0) {
        empty.hidden = false;
        return;
    }

    empty.hidden = true;


    notifications.slice(0, 20).forEach((n) => {

        const el = document.createElement("button");
        el.type = "button";
        el.className = `notification-item ${n.read ? "" : "unread"}`;
        el.dataset.id = n.id;

        el.innerHTML = `
            <div class="notification-icon">
                <i class="bx bx-plus-circle"></i>
            </div>

            <div class="notification-content">
                <p>${describeNotification(n)}</p>
                <span>${formatDate(n.createdAt)}</span>
            </div>
        `;

        el.addEventListener("click", () => handleClick(n));
        list.appendChild(el);

    });

}


// ==================== CLICK HANDLER ====================

async function handleClick(n) {

    const panel = document.getElementById("notificationPanel");

    if (!n.read) {
        try {
            await updateDoc(
                doc(
                    db,
                    "users",
                    currentUser.uid,
                    "notifications",
                    n.id
                ),
                { read: true }
            );
        } catch (error) {
            console.error("Mark read error:", error);
        }
    }

    if (panel) panel.hidden = true;

    const path = window.location.pathname;
    const onBucketList =
        path.endsWith("/bucket-list.html") ||
        path.endsWith("bucket-list.html");

    if (!onBucketList) {
        const inPages = path.includes("/pages/");
        window.location.href = inPages
            ? "bucket-list.html"
            : "pages/bucket-list.html";
    }

}


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


// ==================== PUSH POPUP ====================

function firePush(n) {

    const who = prettyName(n.fromUsername);

    let title = "New from " + who;
    let body = "";

    switch (n.type) {
        case "item_added":
            title = who + " added a new item";
            body = n.itemTitle || "";
            break;

        case "item_completed":
            title = who + " completed an item";
            body = n.itemTitle || "";
            break;

        case "date_reminder_week":
            title = "Coming up in a week";
            body = n.itemTitle || "A special date";
            break;

        case "date_reminder_today":
            title = "It's today!";
            body = n.itemTitle || "A special date";
            break;

        case "cycle_started":
            title = who + " logged a new cycle";
            body = n.itemTitle || "";
            break;

        case "memory_added":
            title = who + " saved a memory";
            body = n.itemTitle || "";
            break;

        default:
            title = "New from " + who;
            body = n.itemTitle || "";
    }

    showPush(title, body);

    // Also fire the on-screen slide-in banner
    showBanner(n);

}


// Turns "dave" into "Dave", "dave_o" into "Dave O"
function prettyName(username) {

    if (!username) return "Your partner";

    const cleaned = username.replace(/[_-]+/g, " ");

    return cleaned
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

}
