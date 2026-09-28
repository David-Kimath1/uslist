import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ==================== STATE ====================

let currentUser = null;
let coupleId = null;
let partnerUid = null;

let presenceHeartbeat = null;
let partnerUnsubscribe = null;
let uiTicker = null;

let lastPartnerSeenTs = undefined;

const HEARTBEAT_MS = 20000;    // ping every 20s while visible
const ONLINE_WINDOW_MS = 45000; // consider online if pinged within 45s


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
    if (!coupleSnap.exists()) return;

    const c = coupleSnap.data();
    partnerUid =
        c.member1Uid === user.uid ? c.member2Uid : c.member1Uid;

    startHeartbeat();
    subscribeToPartner();
    startUiTicker();

    // React to tab focus / visibility
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            pingNow();
        } else {
            markAway();
        }
    });

    window.addEventListener("focus", pingNow);

    // Mark away when the page is being closed
    window.addEventListener("pagehide", markAway);
    window.addEventListener("beforeunload", markAway);

});


// ==================== HEARTBEAT ====================

function startHeartbeat() {

    if (presenceHeartbeat) clearInterval(presenceHeartbeat);

    pingNow();

    presenceHeartbeat = setInterval(() => {
        if (document.visibilityState === "visible") {
            pingNow();
        }
    }, HEARTBEAT_MS);

}


async function pingNow() {

    if (!currentUser) return;

    try {
        await setDoc(
            doc(db, "users", currentUser.uid, "presence", "ping"),
            {
                lastSeen: serverTimestamp(),
                online: true,
                uid: currentUser.uid
            },
            { merge: true }
        );
    } catch (error) {
        console.warn("Presence ping failed:", error);
    }

}


// Called when the user leaves the tab. Writes an "away" state with an
// old-enough timestamp that the partner sees them as offline immediately.
async function markAway() {

    if (!currentUser) return;

    try {
        await setDoc(
            doc(db, "users", currentUser.uid, "presence", "ping"),
            {
                lastSeen: serverTimestamp(),
                online: false,
                uid: currentUser.uid
            },
            { merge: true }
        );
    } catch (error) {
        // Silent — this often races with page unload
    }

}


// ==================== LISTEN TO PARTNER ====================

function subscribeToPartner() {

    if (!partnerUid) return;

    if (partnerUnsubscribe) partnerUnsubscribe();

    partnerUnsubscribe = onSnapshot(
        doc(db, "users", partnerUid, "presence", "ping"),
        (snap) => {

            if (!snap.exists()) {
                lastPartnerSeenTs = undefined;
                updatePartnerIndicator(null, false);
                return;
            }

            const data = snap.data();
            const online = data.online === true;

            lastPartnerSeenTs = data.lastSeen;
            updatePartnerIndicator(data.lastSeen, online);

        },
        (error) => {
            console.warn("Presence listener error:", error);
            updatePartnerIndicator(null, false);
        }
    );

}


// Update relative times every 15s so "1m ago" stays accurate.
function startUiTicker() {

    if (uiTicker) clearInterval(uiTicker);

    uiTicker = setInterval(() => {
        if (lastPartnerSeenTs !== undefined) {
            updatePartnerIndicator(lastPartnerSeenTs, null);
        }
    }, 15000);

}


// ==================== RENDER ====================

function updatePartnerIndicator(lastSeenTs, forcedOnline) {

    const dot = document.getElementById("partnerDot");
    const label = document.getElementById("partnerStatus");

    if (!dot || !label) return;

    if (!lastSeenTs) {
        dot.className = "partner-dot offline";
        label.textContent = "Offline";
        return;
    }

    // Normalise
    let tsMs = 0;
    if (lastSeenTs.seconds) tsMs = lastSeenTs.seconds * 1000;
    else if (lastSeenTs.toDate) tsMs = lastSeenTs.toDate().getTime();

    const now = Date.now();
    const diffMs = now - tsMs;

    // If we know they wrote online=false, immediately offline.
    // Otherwise consider online only if within ONLINE_WINDOW_MS.
    let isOnline;

    if (forcedOnline === false) {
        isOnline = false;
    } else if (forcedOnline === true && diffMs < ONLINE_WINDOW_MS) {
        isOnline = true;
    } else {
        isOnline = diffMs < ONLINE_WINDOW_MS;
    }

    if (isOnline) {
        dot.className = "partner-dot online";
        label.textContent = "Online now";
        return;
    }

    // Offline — describe how long ago
    const diffSec = diffMs / 1000;

    if (diffSec < 60) {
        dot.className = "partner-dot idle";
        label.textContent = "Last seen just now";
    } else if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60);
        dot.className = "partner-dot idle";
        label.textContent = `Last seen ${mins}m ago`;
    } else if (diffSec < 86400) {
        const hours = Math.floor(diffSec / 3600);
        dot.className = "partner-dot idle";
        label.textContent = `Last seen ${hours}h ago`;
    } else {
        const days = Math.floor(diffSec / 86400);
        dot.className = "partner-dot idle";
        label.textContent = days === 1
            ? "Last seen yesterday"
            : `Last seen ${days}d ago`;
    }

}
