import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { toastError, toastWarning } from "./toast.js";


// ==================== STATE ====================

let currentUser = null;
let coupleId = null;
let cycles = [];

let viewingMonth = new Date();
viewingMonth.setDate(1);
viewingMonth.setHours(0, 0, 0, 0);

let cycleToDelete = null;
let unsubscribe = null;


// ==================== ELEMENTS ====================

const cycleModal = document.getElementById("cycleModal");
const openCycleModal = document.getElementById("openCycleModal");
const closeCycleModal = document.getElementById("closeCycleModal");
const cancelCycle = document.getElementById("cancelCycle");
const cycleForm = document.getElementById("cycleForm");
const cycleSubmit = document.getElementById("cycleSubmit");

const deleteCycleModal = document.getElementById("deleteCycleModal");
const deleteCycleText = document.getElementById("deleteCycleText");
const cancelCycleDelete = document.getElementById("cancelCycleDelete");
const confirmCycleDelete = document.getElementById("confirmCycleDelete");

const calGrid = document.getElementById("calGrid");
const calMonthLabel = document.getElementById("calMonthLabel");
const calPrevMonth = document.getElementById("calPrevMonth");
const calNextMonth = document.getElementById("calNextMonth");

const nextPeriodText = document.getElementById("nextPeriodText");
const nextPeriodSubtext = document.getElementById("nextPeriodSubtext");
const ovulationText = document.getElementById("ovulationText");
const ovulationSubtext = document.getElementById("ovulationSubtext");
const fertileText = document.getElementById("fertileText");
const fertileSubtext = document.getElementById("fertileSubtext");

const cycleHistoryList = document.getElementById("cycleHistoryList");
const cycleCount = document.getElementById("cycleCount");
const cycleEmptyState = document.getElementById("cycleEmptyState");


// ==================== DATE HELPERS ====================

function dayNumber(date) {
    return Math.floor(date.getTime() / 86400000);
}

function parseYMD(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
}


// ==================== BOOTSTRAP ====================

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    coupleId = userData.coupleId;
    subscribeToCycles();

});


function subscribeToCycles() {

    if (unsubscribe) unsubscribe();

    const ref = query(
        collection(db, "couples", coupleId, "cycles"),
        orderBy("startDate", "desc")
    );

    unsubscribe = onSnapshot(ref, (snapshot) => {

        cycles = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));

        renderEverything();

    });

}


function renderEverything() {
    renderPredictions();
    renderCalendar();
    renderHistory();
}


// ==================== PREDICTIONS (Flo-style) ====================

function computePredictions() {

    if (cycles.length === 0) return null;

    const sorted = [...cycles].sort(
        (a, b) => parseYMD(b.startDate) - parseYMD(a.startDate)
    );

    let avgCycleLength = 28;
    let avgPeriodLength = 5;

    // Learn cycle length from intervals (only count reasonable ones)
    if (sorted.length >= 2) {
        const intervals = [];
        for (let i = 0; i < Math.min(sorted.length - 1, 6); i++) {
            const a = parseYMD(sorted[i + 1].startDate);
            const b = parseYMD(sorted[i].startDate);
            const diff = daysBetween(a, b);
            if (diff >= 18 && diff <= 60) intervals.push(diff);
        }
        if (intervals.length) {
            avgCycleLength = Math.round(
                intervals.reduce((a, b) => a + b, 0) / intervals.length
            );
        }
    }

    // Learn period length from end dates
    const withEnd = sorted.filter((c) => c.endDate);
    if (withEnd.length) {
        const lengths = withEnd.slice(0, 6).map((c) => {
            const s = parseYMD(c.startDate);
            const e = parseYMD(c.endDate);
            return daysBetween(s, e) + 1;
        });
        if (lengths.length) {
            avgPeriodLength = Math.round(
                lengths.reduce((a, b) => a + b, 0) / lengths.length
            );
        }
    }

    // Build a rolling list of predicted cycles starting from the last
    // logged one. We predict ~12 cycles ahead so the user can scroll
    // back and forward and still see colored days.

    const lastLogged = parseYMD(sorted[0].startDate);

    const predicted = [];

    let cursor = new Date(lastLogged);

    for (let i = 0; i < 12; i++) {

        // Skip the first entry — it's the real logged cycle
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + avgCycleLength);

        const periodStart = new Date(cursor);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + avgPeriodLength - 1);

        // Ovulation = next period - 14 days (luteal phase constant)
        const ovulation = new Date(periodStart);
        ovulation.setDate(ovulation.getDate() - 14);

        // Fertile window = 5 days before ovulation + ovulation day
        const fertileStart = new Date(ovulation);
        fertileStart.setDate(fertileStart.getDate() - 5);

        const fertileEnd = new Date(ovulation);

        predicted.push({
            periodStart,
            periodEnd,
            ovulation,
            fertileStart,
            fertileEnd
        });

    }

    // Current-cycle prediction (based on most recent logged start)
    const currentCycle = {

        periodStart: lastLogged,
        periodEnd: new Date(lastLogged),
        ovulation: new Date(lastLogged),
        fertileStart: new Date(lastLogged),
        fertileEnd: new Date(lastLogged)

    };

    const lastEnd = sorted[0].endDate
        ? parseYMD(sorted[0].endDate)
        : new Date(lastLogged);

    currentCycle.periodEnd = lastEnd;

    // Ovulation for the CURRENT cycle = lastStart + avgCycle - 14
    const currentOvulation = new Date(lastLogged);
    currentOvulation.setDate(
        currentOvulation.getDate() + avgCycleLength - 14
    );
    currentCycle.ovulation = currentOvulation;

    const currentFertileStart = new Date(currentOvulation);
    currentFertileStart.setDate(currentFertileStart.getDate() - 5);
    const currentFertileEnd = new Date(currentOvulation);

    currentCycle.fertileStart = currentFertileStart;
    currentCycle.fertileEnd = currentFertileEnd;

    return {
        avgCycleLength,
        avgPeriodLength,
        currentCycle,
        predicted,
        lastLoggedStart: lastLogged
    };

}


function renderPredictions() {

    const p = computePredictions();

    if (!p) {
        nextPeriodText.textContent = "—";
        nextPeriodSubtext.textContent = "Log a cycle to see predictions";
        ovulationText.textContent = "—";
        ovulationSubtext.textContent = "—";
        fertileText.textContent = "—";
        fertileSubtext.textContent = "—";
        return;
    }

    const now = new Date();
    const today = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        0, 0, 0, 0
    );

    // Next period = first predicted whose start is in the future
    let next = p.predicted.find(
        (c) => dayNumber(c.periodStart) >= dayNumber(today)
    );

    if (!next) next = p.predicted[0];

    const daysToPeriod = daysBetween(today, next.periodStart);

    if (daysToPeriod > 0) {
        nextPeriodText.textContent = `in ${daysToPeriod} ${
            daysToPeriod === 1 ? "day" : "days"
        }`;
        nextPeriodSubtext.textContent = fmt(next.periodStart);
    } else if (daysToPeriod === 0) {
        nextPeriodText.textContent = "Today";
        nextPeriodSubtext.textContent = "Expected to begin";
    } else {
        nextPeriodText.textContent = `${Math.abs(daysToPeriod)} days late`;
        nextPeriodSubtext.textContent = `Was expected ${fmt(next.periodStart)}`;
    }

    // Ovulation — nearest upcoming
    const allOv = [
        p.currentCycle,
        ...p.predicted
    ].map((c) => c.ovulation);

    const upcomingOv = allOv
        .filter((d) => dayNumber(d) >= dayNumber(today))
        .sort((a, b) => a - b)[0];

    if (upcomingOv) {

        const daysToOv = daysBetween(today, upcomingOv);

        if (daysToOv === 0) {
            ovulationText.textContent = "Today";
        } else {
            ovulationText.textContent = `in ${daysToOv} ${
                daysToOv === 1 ? "day" : "days"
            }`;
        }

        ovulationSubtext.textContent = fmt(upcomingOv);

    } else {
        ovulationText.textContent = "—";
        ovulationSubtext.textContent = "—";
    }

    // Fertile window — nearest upcoming
    const allFertile = [
        p.currentCycle,
        ...p.predicted
    ];

    const upcomingFertile = allFertile.find(
        (c) =>
            dayNumber(c.fertileEnd) >= dayNumber(today)
    );

    if (upcomingFertile) {

        const inWindow =
            dayNumber(today) >= dayNumber(upcomingFertile.fertileStart) &&
            dayNumber(today) <= dayNumber(upcomingFertile.fertileEnd);

        if (inWindow) {
            fertileText.textContent = "Currently fertile";
        } else {
            const days = daysBetween(today, upcomingFertile.fertileStart);
            fertileText.textContent = `in ${days} ${
                days === 1 ? "day" : "days"
            }`;
        }

        fertileSubtext.textContent =
            `${fmt(upcomingFertile.fertileStart)} – ${fmt(upcomingFertile.fertileEnd)}`;

    } else {
        fertileText.textContent = "—";
        fertileSubtext.textContent = "—";
    }

}


// ==================== CALENDAR (Flo-style) ====================

function renderCalendar() {

    if (!calGrid) return;

    // Force local midnight to avoid timezone drift
    viewingMonth = new Date(
        viewingMonth.getFullYear(),
        viewingMonth.getMonth(),
        1,
        0, 0, 0, 0
    );

    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();

    calMonthLabel.textContent = viewingMonth.toLocaleDateString(
        undefined,
        { month: "long", year: "numeric" }
    );

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    calGrid.innerHTML = "";

    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
        const cell = document.createElement("div");
        cell.className = "cycle-day cycle-day-other";
        cell.textContent = prevMonthDays - i;
        calGrid.appendChild(cell);
    }

    const p = computePredictions();

    const now = new Date();
    const todayLocalMidnight = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        0, 0, 0, 0
    );
    const todayNum = dayNumber(todayLocalMidnight);

    for (let d = 1; d <= daysInMonth; d++) {

        const date = new Date(year, month, d, 0, 0, 0, 0);
        const dateNum = dayNumber(date);

        const cell = document.createElement("div");
        cell.className = "cycle-day";
        cell.textContent = d;

        if (dateNum === todayNum) {
            cell.classList.add("cycle-day-today");
        }

        const cat = dayCategory(dateNum, p);
        if (cat) cell.classList.add(`cycle-day-${cat}`);

        calGrid.appendChild(cell);

    }

    const totalFilled = startWeekday + daysInMonth;
    const trailing = (7 - (totalFilled % 7)) % 7;

    for (let i = 1; i <= trailing; i++) {
        const cell = document.createElement("div");
        cell.className = "cycle-day cycle-day-other";
        cell.textContent = i;
        calGrid.appendChild(cell);
    }

}


function dayCategory(dateNum, p) {

    // 1) LOGGED period days (real data) → solid red
    for (const c of cycles) {

        const start = dayNumber(parseYMD(c.startDate));
        const end = c.endDate
            ? dayNumber(parseYMD(c.endDate))
            : start;

        if (dateNum >= start && dateNum <= end) {
            return "period-logged";
        }

    }

    if (!p) return null;

    // 2) PREDICTED period days → dashed/lighter red
    for (const pred of p.predicted) {

        const s = dayNumber(pred.periodStart);
        const e = dayNumber(pred.periodEnd);

        if (dateNum >= s && dateNum <= e) {
            return "period-predicted";
        }

    }

    // 3) Logged cycle's fertile window (past fertile days)
    const cc = p.currentCycle;

    if (
        dateNum >= dayNumber(cc.fertileStart) &&
        dateNum <= dayNumber(cc.fertileEnd)
    ) {

        if (dateNum === dayNumber(cc.ovulation)) return "ovulation";

        return "fertile";

    }

    // 4) Predicted cycles' fertile + ovulation
    for (const pred of p.predicted) {

        if (
            dateNum >= dayNumber(pred.fertileStart) &&
            dateNum <= dayNumber(pred.fertileEnd)
        ) {

            if (dateNum === dayNumber(pred.ovulation)) return "ovulation";

            return "fertile";

        }

    }

    // 5) Safe days — anything after the earliest logged cycle start
    //    that isn't period / fertile / ovulation
    if (cycles.length > 0) {

        const earliest = dayNumber(parseYMD(
            [...cycles].sort(
                (a, b) => parseYMD(a.startDate) - parseYMD(b.startDate)
            )[0].startDate
        ));

        if (dateNum >= earliest) {
            return "safe";
        }

    }

    return null;

}


calPrevMonth?.addEventListener("click", () => {
    viewingMonth.setMonth(viewingMonth.getMonth() - 1);
    renderCalendar();
});

calNextMonth?.addEventListener("click", () => {
    viewingMonth.setMonth(viewingMonth.getMonth() + 1);
    renderCalendar();
});


// ==================== HISTORY LIST ====================

function renderHistory() {

    if (!cycleHistoryList) return;

    cycleHistoryList.innerHTML = "";

    cycleCount.textContent =
        `${cycles.length} ${
            cycles.length === 1 ? "cycle" : "cycles"
        }`;

    if (cycles.length === 0) {
        cycleEmptyState.classList.add("visible");
        return;
    }

    cycleEmptyState.classList.remove("visible");

    cycles.forEach((c) => {

        const el = document.createElement("div");
        el.className = "cycle-history-item";

        const start = parseYMD(c.startDate);
        const end = c.endDate ? parseYMD(c.endDate) : null;
        const length = end ? daysBetween(start, end) + 1 : null;

        el.innerHTML = `
            <div class="cycle-history-icon">
                <i class="bx bx-droplet"></i>
            </div>

            <div class="cycle-history-body">
                <strong>
                    ${fmt(start)}${end ? " – " + fmt(end) : " – ongoing"}
                </strong>
                <span>
                    ${length ? length + " days" : "Ongoing"}
                    ${c.notes ? " · " + escapeHTML(c.notes) : ""}
                </span>
            </div>

            <button
                class="cycle-history-delete"
                data-action="delete"
                data-id="${c.id}"
                aria-label="Delete"
            >
                <i class="bx bx-trash"></i>
            </button>
        `;

        cycleHistoryList.appendChild(el);

    });

}


cycleHistoryList?.addEventListener("click", (event) => {

    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "delete") {
        openDeleteModal(button.dataset.id);
    }

});


// ==================== MODAL ====================

function openModal() {
    cycleModal.classList.add("show");
    setTimeout(() => {
        document.getElementById("cycleStart").focus();
    }, 100);
}

function closeModal() {
    cycleModal.classList.remove("show");
    cycleForm.reset();
}

openCycleModal?.addEventListener("click", openModal);
closeCycleModal?.addEventListener("click", closeModal);
cancelCycle?.addEventListener("click", closeModal);

cycleModal?.addEventListener("click", (event) => {
    if (event.target === cycleModal) closeModal();
});


cycleForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId || !currentUser) return;

    const startDate = document.getElementById("cycleStart").value;
    const endDate = document.getElementById("cycleEnd").value || null;
    const notes = document.getElementById("cycleNotes").value.trim();

    if (!startDate) return;

    if (endDate && endDate < startDate) {
        toastWarning("End date cannot be before start date.");
        return;
    }

    try {

        cycleSubmit.disabled = true;
        cycleSubmit.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        await addDoc(
            collection(db, "couples", coupleId, "cycles"),
            {
                startDate,
                endDate,
                notes,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        closeModal();

    } catch (error) {

        console.error("Add cycle error:", error);
        toastError("Could not save cycle.");

    } finally {

        cycleSubmit.disabled = false;
        cycleSubmit.innerHTML =
            '<i class="bx bx-heart"></i> Save Cycle';

    }

});


// ==================== DELETE ====================

function openDeleteModal(id) {

    const c = cycles.find((x) => x.id === id);
    if (!c) return;

    cycleToDelete = id;
    deleteCycleText.textContent =
        `Cycle starting ${fmt(parseYMD(c.startDate))} will be permanently removed.`;
    deleteCycleModal.classList.add("show");

}

function closeDeleteModal() {
    deleteCycleModal.classList.remove("show");
    cycleToDelete = null;
}

cancelCycleDelete?.addEventListener("click", closeDeleteModal);

confirmCycleDelete?.addEventListener("click", async () => {

    if (!cycleToDelete) return;

    try {
        await deleteDoc(
            doc(db, "couples", coupleId, "cycles", cycleToDelete)
        );
        closeDeleteModal();
    } catch (error) {
        console.error("Delete cycle error:", error);
        closeDeleteModal();
    }

});

deleteCycleModal?.addEventListener("click", (event) => {
    if (event.target === deleteCycleModal) closeDeleteModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (cycleModal?.classList.contains("show")) closeModal();
    if (deleteCycleModal?.classList.contains("show")) closeDeleteModal();
});


// ==================== HELPERS ====================

function fmt(date) {
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
