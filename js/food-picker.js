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
import { confirmDialog as confirmAction } from "./confirm.js";


// ==================== SEED DISHES ====================

const SEED_DISHES = [
    // ============ MAINS ============
    "Ugali & Sukuma Wiki",
    "Ugali & Spinach",
    "Ugali, Sukuma & Spinach",
    "Ugali & Nyama Choma",
    "Ugali & Fish",
    "Ugali & Liver",
    "Chapati & Beans",
    "Chapati & Ndengu",
    "Chapati & Beef Stew",
    "Chapati & Chicken Stew",
    "Chapati & Madondo",
    "Rice & Beans",
    "Rice & Ndengu",
    "Pilau & Kachumbari",
    "Pilau & Chicken",
    "Biriani & Kachumbari",
    "Coconut Rice & Fish Curry",
    "Wali wa Nazi & Maharage",
    "Githeri",
    "Githeri & Avocado",
    "Mukimo & Beef Stew",
    "Mukimo & Nyama Choma",
    "Matoke & Beef",
    "Matoke & Peanut Sauce",
    "Mashed Potatoes & Beef",
    "Chicken Stew & Rice",
    "Beef Stew & Rice",
    "Beef Stew & Chapati",
    "Goat Meat Stew",
    "Nyama Choma & Kachumbari",
    "Nyama Choma & Ugali",
    "Kuku Choma & Fries",
    "Fried Fish & Ugali",
    "Tilapia Wet Fry",
    "Tilapia Dry Fry",
    "Fish Curry & Rice",
    "Grilled Tilapia & Chips",
    "Liver & Onions",
    "Beef Fry (Dry Fry)",
    "Chicken Dry Fry",
    "Mutton Stew",
    "Mutton Biriani",

    // ============ STREET FOOD & SNACKS ============
    "Samosa (Beef)",
    "Samosa (Chicken)",
    "Samosa (Vegetable)",
    "Sausage Roll",
    "Meat Pie",
    "Chicken Pie",
    "Smokie Pasua",
    "Smokie & Kachumbari",
    "Sausage & Chips",
    "Chips Masala",
    "Chips Mayai",
    "Bhajia",
    "Viazi Karai",
    "Chapati & Ndengu (Street Style)",
    "Mutura",
    "Kebab (Mishkaki)",
    "Roasted Maize (Mahindi Choma)",
    "Boiled Maize & Beans",
    "Roasted Cassava (Muhogo)",
    "Boiled Cassava (Muhogo)",
    "Cassava Crisps",
    "Arrowroot (Nduma)",
    "Sweet Potatoes (Ngwaci)",
    "Boiled Sweet Potatoes & Tea",
    "Sweet Potato Chips",
    "Plantain Chips",

    // ============ BREAKFAST ============
    "Uji (Millet Porridge)",
    "Uji Power",
    "Mandazi & Chai",
    "Mahamri & Mbaazi",
    "Mahamri & Chai",
    "Chapati & Chai",
    "Chapati Madondo",
    "Kaimati",
    "Vitumbua",
    "Kebab & Chai",
    "Boiled Eggs & Chai",
    "Omelette & Bread",
    "Toast, Butter & Jam",
    "Pancakes & Syrup",
    "Kenyan Tea (Chai ya Maziwa)",
    "Black Tea (Chai ya Rangi)",
    "Ginger Tea",
    "Lemon Tea",

    // ============ SIDES & ACCOMPANIMENTS ============
    "Sukuma Wiki",
    "Spinach",
    "Kunde",
    "Spinach & Cream",
    "Cabbage & Carrots",
    "Kachumbari",
    "Ndengu (Green Grams)",
    "Beans (Maharagwe)",
    "Madondo (Black Beans)",
    "Avocado Slices",
    "Roasted Groundnuts",

    // ============ DESSERTS & SWEETS ============
    "Kaimati (Sweet)",
    "Vitumbua (Coconut)",
    "Fruit Salad",
    "Mango Slices",
    "Watermelon",
    "Pineapple",
    "Ice Cream",
    "Chocolate Cake",
    "Mandazi (Sweet)",

    // ============ DRINKS ============
    "Passion Juice",
    "Mango Juice",
    "Avocado Smoothie",
    "Tamarind Juice (Ukwaju)",
    "Dawa (Honey & Lemon)",
    "Fresh Sugarcane Juice",
    "Coconut Water",
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



// ==================== SYNC DISH LIST ====================

const resetBtn = document.getElementById("resetDishesBtn");

resetBtn?.addEventListener("click", async () => {

    const ok = await confirmAction({
        title: "Sync dish list?",
        message: "This adds new dishes from the code list and removes ones no longer there. Dishes you added manually are kept.",
        confirmText: "Sync",
        cancelText: "Cancel",
        variant: "primary",
        icon: "bx-refresh"
    });

    if (!ok) return;

    try {

        resetBtn.disabled = true;
        resetBtn.innerHTML =
            '<i class="bx bx-loader-alt bx-spin"></i> Syncing...';

        const { getDocs, deleteDoc } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
        );

        const ref = collection(db, "couples", coupleId, "foodDishes");
        const snap = await getDocs(ref);

        // Build a map of existing dishes: nameLower -> doc
        const existing = new Map();
        snap.docs.forEach((d) => {
            const data = d.data();
            const key = (data.name || "").toLowerCase().trim();
            if (key) existing.set(key, d);
        });

        // Build the desired list from code
        const desired = new Map();
        SEED_DISHES.forEach((name) => {
            desired.set(name.toLowerCase().trim(), name);
        });

        let added = 0;
        let removed = 0;

        // ADD: things in code but not in Firestore
        for (const [key, name] of desired) {
            if (!existing.has(key)) {
                await addDoc(ref, {
                    name,
                    addedBy: currentUser.uid,
                    source: "seed",
                    createdAt: serverTimestamp()
                });
                added++;
            }
        }

        // REMOVE: things in Firestore but not in code
        // ONLY remove ones tagged as "seed" — keep user-added dishes
        for (const [key, docSnap] of existing) {
            const data = docSnap.data();
            const isSeed = data.source === "seed";

            if (!desired.has(key) && isSeed) {
                await deleteDoc(docSnap.ref);
                removed++;
            }
        }

        console.log(`✓ Synced: +${added} added, -${removed} removed`);

        resetBtn.innerHTML =
            `<i class="bx bx-check"></i> Done (+${added} / -${removed})`;

        setTimeout(() => {
            resetBtn.disabled = false;
            resetBtn.innerHTML =
                '<i class="bx bx-refresh"></i> Sync dish list';
        }, 3000);

    } catch (error) {

        console.error("Sync error:", error);
        resetBtn.disabled = false;
        resetBtn.innerHTML =
            '<i class="bx bx-refresh"></i> Sync dish list';
        toastError("Sync failed. Check the console.");

    }

});
