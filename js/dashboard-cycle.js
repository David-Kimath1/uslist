import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    const cyclesSnap = await getDocs(
        query(
            collection(db, "couples", userData.coupleId, "cycles"),
            orderBy("startDate", "desc"),
            limit(6)
        )
    );

    if (cyclesSnap.empty) return;

    const cycles = cyclesSnap.docs.map((d) => d.data());

    // Average cycle length
    let avg = 28;
    if (cycles.length >= 2) {
        const intervals = [];
        for (let i = 0; i < cycles.length - 1; i++) {
            const a = new Date(cycles[i + 1].startDate);
            const b = new Date(cycles[i].startDate);
            const diff = Math.round((b - a) / 86400000);
            if (diff > 15 && diff < 60) intervals.push(diff);
        }
        if (intervals.length) {
            avg = Math.round(
                intervals.reduce((s, v) => s + v, 0) / intervals.length
            );
        }
    }

    // Predict next period
    const lastStart = new Date(cycles[0].startDate);
    const nextStart = new Date(lastStart);
    nextStart.setDate(nextStart.getDate() + avg);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = Math.round((nextStart - today) / 86400000);

    // Show prompt if within +/- 2 days of prediction
    const prompt = document.getElementById("dashboardCyclePrompt");
    if (!prompt) return;

    if (Math.abs(diff) <= 2) {

        prompt.hidden = false;

        const title = document.getElementById("cyclePromptTitle");
        const text = document.getElementById("cyclePromptText");

        if (diff > 0) {
            title.textContent = `Period expected in ${diff} ${
                diff === 1 ? "day" : "days"
            }`;
            text.textContent = "Tap to log it when it starts.";
        } else if (diff === 0) {
            title.textContent = "Period expected today";
            text.textContent = "Tap to log it.";
        } else {
            title.textContent = `Period may be late by ${Math.abs(diff)} ${
                Math.abs(diff) === 1 ? "day" : "days"
            }`;
            text.textContent = "Log it when it starts.";
        }

    }

});
