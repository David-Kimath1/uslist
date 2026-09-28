import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    addDoc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    const coupleId = userData.coupleId;

    const coupleSnap = await getDoc(doc(db, "couples", coupleId));
    if (!coupleSnap.exists()) return;

    const c = coupleSnap.data();
    const partnerUid =
        c.member1Uid === user.uid ? c.member2Uid : c.member1Uid;

    if (!partnerUid) return;

    const datesSnap = await getDocs(
        query(
            collection(db, "couples", coupleId, "dates"),
            where("important", "==", true)
        )
    );

    const now = new Date();
    const todayKey = ymd(now);

    for (const docSnap of datesSnap.docs) {

        const d = docSnap.data();
        const [y, m, day] = d.date.split("-").map(Number);

        let target = d.recurring
            ? new Date(now.getFullYear(), m - 1, day)
            : new Date(y, m - 1, day);

        if (d.recurring && target < startOfDay(now)) {
            target = new Date(now.getFullYear() + 1, m - 1, day);
        }

        const diffDays = Math.round(
            (startOfDay(target) - startOfDay(now)) / 86400000
        );

        if (diffDays === 7) {
            await sendOnce(
                user.uid,
                partnerUid,
                userData.username,
                "date_reminder_week",
                d,
                todayKey
            );
        }

        if (diffDays === 0) {
            await sendOnce(
                user.uid,
                partnerUid,
                userData.username,
                "date_reminder_today",
                d,
                todayKey
            );
        }

    }

});


async function sendOnce(
    fromUid,
    toUid,
    fromUsername,
    type,
    dateData,
    todayKey
) {

    const notifRef = collection(db, "users", toUid, "notifications");

    const existing = await getDocs(
        query(
            notifRef,
            where("type", "==", type),
            where("itemTitle", "==", dateData.title),
            where("dayKey", "==", todayKey)
        )
    );

    if (!existing.empty) return;

    await addDoc(notifRef, {
        type,
        fromUid,
        fromUsername,
        itemTitle: dateData.title,
        dayKey: todayKey,
        read: false,
        createdAt: serverTimestamp()
    });

}


function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}