import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/**
 * Log an event to the couple's timeline.
 *
 * type: "item_added" | "item_completed" | "memory_added" | "date_added"
 * data: { title, category, refId, ... }
 */
export async function logEvent(type, data = {}) {

    const user = auth.currentUser;
    if (!user) return;

    try {

        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        if (!userData.coupleId) return;

        await addDoc(
            collection(db, "couples", userData.coupleId, "timeline"),
            {
                type,
                actorUid: user.uid,
                actorUsername: userData.username || "partner",
                data,
                createdAt: serverTimestamp()
            }
        );

    } catch (error) {

        console.error("Timeline log error:", error);

    }

}
