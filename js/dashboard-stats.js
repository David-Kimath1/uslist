import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


let coupleId = null;
let currentUser = null;

let itemsSub = null;
let memoriesSub = null;

let items = [];
let memories = [];


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    coupleId = userData.coupleId;

    subscribeItems();
    subscribeMemories();

});


function subscribeItems() {

    if (itemsSub) itemsSub();

    itemsSub = onSnapshot(
        collection(db, "couples", coupleId, "items"),
        (snapshot) => {

            // Only count items the current user can see
            items = snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((i) => {
                    if (i.visibility === "shared") return true;
                    return i.createdBy === currentUser.uid;
                });

            renderStats();

        }
    );

}


function subscribeMemories() {

    if (memoriesSub) memoriesSub();

    memoriesSub = onSnapshot(
        collection(db, "couples", coupleId, "memories"),
        (snapshot) => {

            memories = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data()
            }));

            renderStats();

        }
    );

}


function renderStats() {

    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const progress = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    const totalEl = document.getElementById("statTotal");
    const completedEl = document.getElementById("statCompleted");
    const memoriesEl = document.getElementById("statMemories");
    const progressEl = document.getElementById("statProgress");

    if (totalEl) totalEl.textContent = total;
    if (completedEl) completedEl.textContent = completed;
    if (memoriesEl) memoriesEl.textContent = memories.length;
    if (progressEl) progressEl.textContent = progress + "%";

    // Progress panel
    const ppPercent = document.getElementById("progressPercent");
    const ppCompleted = document.getElementById("progressCompleted");
    const ppRemaining = document.getElementById("progressRemaining");
    const ppCircle = document.getElementById("progressCircle");

    if (ppPercent) ppPercent.textContent = progress + "%";
    if (ppCompleted) ppCompleted.textContent = completed;
    if (ppRemaining) ppRemaining.textContent = total - completed;

    // Rotate the conic-gradient ring to match the real %
    if (ppCircle) {
        const deg = Math.round((progress / 100) * 360);
        ppCircle.style.background =
            `conic-gradient(var(--primary) 0deg ${deg}deg, var(--primary-soft) ${deg}deg 360deg)`;
    }

}
