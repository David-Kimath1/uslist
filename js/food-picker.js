import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { logEvent } from "./timeline-logger.js";
import { toastError, toastWarning } from "./toast.js";


// ==================== SEED DISHES ====================

const SEED_DISHES = [
    "Spaghetti Bolognese",
    "Chicken Curry & Rice",
    "Grilled Fish & Ugali",
    "Beef Stew & Chapati",
    "Vegetable Stir Fry",
    "Homemade Pizza",
    "Tacos",
    "Pilau & Kachumbari",
    "Shakshuka",
    "Pancakes",
    "Nyama Choma & Kachumbari",
    "Thai Green Curry",
    "Burger Night",
    "Fajitas",
    "Sushi Bowl",
    "Chicken Wings & Fries",
    "Shepherd's Pie",
    "Fried Rice & Chicken",
    "Soup & Grilled Cheese",
    "Creamy Carbonara",
    "Biriani",
    "Veggie Buddha Bowl",
    "Meatballs & Mash",
    "Quesadillas",
    "Chicken Shawarma",
    "Ugali & Sukuma Wiki",
    "Fish Tacos",
    "Ramen",
    "Chili con Carne",
    "Breakfast Burrito",
    "Chapati & Beans",
    "Matoke & Beef",
    "Githeri",
    "Mukimo & Beef Stew",
    "Rice & Beans",
    "Pasta Salad",
    "Omelette & Toast",
    "Grilled Cheese & Tomato Soup",
    "Kebabs & Pita",
    "Stuffed Peppers",
    "Vegetable Soup & Bread",
    "Chicken Alfredo",
    "Beef Stroganoff",
    "Couscous & Veggies",
    "Sweet & Sour Chicken",
    "Baked Salmon & Potatoes",
    "Fish Curry",
    "Bean Burrito Bowl",
    "Wraps & Salad",
    "Shrimp Fried Rice",
    "Beef Tacos",
    "Egg Fried Rice",
    "Pumpkin Soup",
    "Lentil Curry",
    "Cheese Ravioli",
    "Chicken Quesadilla",
    "Avocado Toast & Eggs",
    "Club Sandwich & Fries",
    "Fish & Chips"
];


// ==================== STATE ====================

let currentUser = null;
let coupleId = null;
let dishes = [];

let dishesSub = null;
let seeded = false;


// ==================== ELEMENTS ====================

const display = document.getElementById("foodDisplay");
const button = document.getElementById("foodPickerButton");
const actionsWrap = document.getElementById("foodPickerActions");
const cookedBtn = document.getElementById("foodCookedButton");
const otherBtn = document.getElementById("foodOtherButton");

const cookModal = document.getElementById("cookLogModal");
const closeCookLog = document.getElementById("closeCookLog");
const cancelCookLog = document.getElementById("cancelCookLog");
const cookLogForm = document.getElementById("cookLogForm");
const cookName = document.getElementById("cookName");
const cookDate = document.getElementById("cookDate");
const cookNotes = document.getElementById("cookNotes");
const cookLogSubmit = document.getElementById("cookLogSubmit");


// ==================== BOOTSTRAP ====================

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (!userData.coupleId) return;

    coupleId = userData.coupleId;

    await seedDishesIfEmpty();
    subscribeToDishes();

});


async function seedDishesIfEmpty() {

    if (seeded) return;

    try {

        const ref = collection(db, "couples", coupleId, "foodDishes");
        const snap = await new Promise((resolve) => {
            const unsub = onSnapshot(ref, (s) => {
                unsub();
                resolve(s);
            });
        });

        if (snap.empty) {
            for (const name of SEED_DISHES) {
                await addDoc(ref, {
                    name,
                    addedBy: currentUser.uid,
                    createdAt: serverTimestamp()
                });
            }
        }

        seeded = true;

    } catch (error) {
        console.error("Seed dishes error:", error);
    }

}


function subscribeToDishes() {

    if (dishesSub) dishesSub();

    dishesSub = onSnapshot(
        collection(db, "couples", coupleId, "foodDishes"),
        (snap) => {
            dishes = snap.docs.map((d) => ({
                id: d.id,
                ...d.data()
            }));
        }
    );

}


// ==================== PICKER ====================

let rolling = false;
let currentPick = null;


button?.addEventListener("click", () => {

    if (rolling) return;
    if (dishes.length === 0) {
        toastWarning("No dishes yet — add one by cooking something first!");
        return;
    }

    rolling = true;
    button.disabled = true;

    actionsWrap.hidden = true;

    const start = Date.now();
    const duration = 1600;

    let delay = 60;

    const tick = () => {

        const picked = dishes[Math.floor(Math.random() * dishes.length)];

        display.innerHTML = `
            <span class="food-picker-rolling">
                ${escapeHTML(picked.name)}
            </span>
        `;

        const elapsed = Date.now() - start;

        if (elapsed >= duration) {
            finalize();
            return;
        }

        const progress = elapsed / duration;
        delay = 60 + progress * progress * 240;
        setTimeout(tick, delay);

    };

    const finalize = () => {

        const finalDish = dishes[Math.floor(Math.random() * dishes.length)];

        currentPick = finalDish.name;

        display.innerHTML = `
            <div class="food-picker-final">
                <i class="bx bx-check-circle"></i>
                <strong>${escapeHTML(finalDish.name)}</strong>
            </div>
        `;

        button.disabled = false;
        button.innerHTML = '<i class="bx bx-shuffle"></i> Pick again';

        actionsWrap.hidden = false;

        rolling = false;

    };

    tick();

});


// ==================== LOG COOKED ====================

cookedBtn?.addEventListener("click", () => {
    openCookModal(currentPick || "");
});

otherBtn?.addEventListener("click", () => {
    openCookModal("");
});


function openCookModal(prefill) {

    if (!cookModal) return;

    cookName.value = prefill || "";

    // Default date to today
    const today = new Date();
    cookDate.value = today.toISOString().slice(0, 10);

    cookModal.classList.add("show");

    setTimeout(() => {
        cookName.focus();
    }, 100);

}


function closeCookModal() {

    if (!cookModal) return;

    cookModal.classList.remove("show");
    cookLogForm.reset();

}


closeCookLog?.addEventListener("click", closeCookModal);
cancelCookLog?.addEventListener("click", closeCookModal);

cookModal?.addEventListener("click", (event) => {
    if (event.target === cookModal) closeCookModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && cookModal?.classList.contains("show")) {
        closeCookModal();
    }
});


cookLogForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!coupleId || !currentUser) return;

    const name = cookName.value.trim();
    const date = cookDate.value;
    const notes = cookNotes.value.trim();

    const mealInput = document.querySelector(
        'input[name="cookMeal"]:checked'
    );
    const meal = mealInput ? mealInput.value : "meal";

    if (!name || !date) return;

    try {

        cookLogSubmit.disabled = true;
        cookLogSubmit.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        // 1) Create a memory
        const memoryRef = await addDoc(
            collection(db, "couples", coupleId, "memories"),
            {
                title: `${capitalize(meal)}: ${name}`,
                date,
                description: notes || "",
                category: "dates",
                linkedItemId: null,
                meal,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        // 2) Log to timeline
        await logEvent("memory_added", {
            title: `${capitalize(meal)}: ${name}`,
            category: "dates",
            date
        });

        // 3) If the dish is new, add it to the dish list
        const exists = dishes.some(
            (d) => d.name.toLowerCase() === name.toLowerCase()
        );

        if (!exists) {
            await addDoc(
                collection(db, "couples", coupleId, "foodDishes"),
                {
                    name,
                    addedBy: currentUser.uid,
                    createdAt: serverTimestamp()
                }
            );
        }

        closeCookModal();

        // Reset the picker UI
        display.innerHTML = `
            <span class="food-picker-placeholder">
                Saved! Pick again whenever you're hungry.
            </span>
        `;
        button.innerHTML = '<i class="bx bx-shuffle"></i> Pick a dish';
        actionsWrap.hidden = true;
        currentPick = null;

    } catch (error) {

        console.error("Cook log error:", error);
        toastError("Could not save. Please try again.");

    } finally {

        cookLogSubmit.disabled = false;
        cookLogSubmit.innerHTML =
            '<i class="bx bx-heart"></i> Save to memories';

    }

});


// ==================== HELPERS ====================

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}
