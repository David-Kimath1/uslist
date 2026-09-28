import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    const datesSnap = await getDocs(
        query(
            collection(db, "couples", userData.coupleId, "dates"),
            where("important", "==", true)
        )
    );

    if (datesSnap.empty) return;

    const dates = datesSnap.docs.map((d) => d.data());

    dates.sort((a, b) => nextOccurrence(a) - nextOccurrence(b));

    const next = dates[0];

    document.getElementById("dashboardNextDate").hidden = false;
    document.getElementById("dashDateTitle").textContent = next.title;
    document.getElementById("dashDateLabel").textContent =
        formatDate(next.date, next.recurring) +
        (next.recurring ? " · Every year" : "");

    const tick = () => {

        const diff = nextOccurrence(next) - Date.now();
        const s = Math.max(0, Math.floor(diff / 1000));

        document.getElementById("dashDays").textContent =
            String(Math.floor(s / 86400)).padStart(2, "0");
        document.getElementById("dashHours").textContent =
            String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
        document.getElementById("dashMinutes").textContent =
            String(Math.floor((s % 3600) / 60)).padStart(2, "0");
        document.getElementById("dashSeconds").textContent =
            String(s % 60).padStart(2, "0");

    };

    tick();
    setInterval(tick, 1000);

});


function nextOccurrence(d) {

    const [y, m, day] = d.date.split("-").map(Number);
    const now = new Date();

    let target = d.recurring
        ? new Date(now.getFullYear(), m - 1, day)
        : new Date(y, m - 1, day);

    if (
        d.recurring &&
        target < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ) {
        target = new Date(now.getFullYear() + 1, m - 1, day);
    }

    return target.getTime();

}

function formatDate(dateString, recurring) {

    const [y, m, d] = dateString.split("-").map(Number);
    const date = new Date(y, m - 1, d);

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: recurring ? undefined : "numeric"
    });

}