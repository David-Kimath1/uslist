import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    onSnapshot,
    query,
    orderBy,
    limit,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


let currentUser = null;
let coupleId = null;
let partnerUid = null;
let currentUsername = null;

let unsubscribe = null;
let lastSeenCycleId = null;
let initialized = false;


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    currentUsername = userData.username || "partner";

    if (!userData.coupleId) return;

    coupleId = userData.coupleId;

    const coupleSnap = await getDoc(doc(db, "couples", coupleId));
    if (!coupleSnap.exists()) return;

    const c = coupleSnap.data();
    partnerUid =
        c.member1Uid === user.uid ? c.member2Uid : c.member1Uid;

    // Load last cycle id (so we don't notify for old cycles on page load)
    const { getDocs } = await import(
        "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
    );

    const snap = await getDocs(
        query(
            collection(db, "couples", coupleId, "cycles"),
            orderBy("startDate", "desc"),
            limit(1)
        )
    );

    if (!snap.empty) {
        lastSeenCycleId = snap.docs[0].id;
    }

    initialized = true;

    watchCycles();

});


function watchCycles() {

    if (unsubscribe) unsubscribe();

    unsubscribe = onSnapshot(
        query(
            collection(db, "couples", coupleId, "cycles"),
            orderBy("startDate", "desc"),
            limit(1)
        ),
        (snapshot) => {

            if (snapshot.empty) return;

            const docSnap = snapshot.docs[0];

            if (!initialized) {
                lastSeenCycleId = docSnap.id;
                return;
            }

            if (docSnap.id === lastSeenCycleId) return;

            // New cycle appeared
            lastSeenCycleId = docSnap.id;

            const c = docSnap.data();

            // Don't notify the creator
            if (c.createdBy === currentUser.uid) return;

            if (!partnerUid) return;

            sendNotification(c);

        }
    );

}


async function sendNotification(cycleData) {

    try {

        await addDoc(
            collection(db, "users", partnerUid, "notifications"),
            {
                type: "cycle_started",
                fromUid: currentUser.uid,
                fromUsername: currentUsername,
                itemTitle: `Period started ${cycleData.startDate}`,
                read: false,
                createdAt: serverTimestamp()
            }
        );

    } catch (error) {

        console.error("Cycle notification error:", error);

    }

}
