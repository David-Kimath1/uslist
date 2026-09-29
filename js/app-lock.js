// ==================== APP LOCK ====================
// Per-user biometric + PIN lock. Runs on every page.
// If lock is enabled and the app hasn't been unlocked in the last 2 min,
// shows a full-screen overlay until the user authenticates.


import { attachEye } from "./pin-eye.js";


// ==================== STATE ====================

let currentUser = null;
let userDocRef = null;
let lockData = null;

let overlay = null;
let onUnlockCallback = null;

const LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const MAX_PIN_ATTEMPTS = 5;
const MAX_RECOVERY_ATTEMPTS = 3;

let pinAttempts = 0;
let recoveryAttempts = 0;
let currentMode = "pin"; // "pin" | "recovery"


// ==================== HELPERS ====================

async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(hashBuf)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function generateRecoveryCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code.slice(0, 4) + "-" + code.slice(4);
}

function toast(msg, type = "error") {
    import("./toast.js").then((m) => {
        if (type === "error") m.toastError(msg);
        else if (type === "warning") m.toastWarning(msg);
        else m.toastInfo(msg);
    }).catch(() => {
        console.log("[Lock]", type, msg);
    });
}


// ==================== PUBLIC API ====================

/**
 * Call this once after the user is known to be signed in.
 * It reads the user's lock settings and, if needed, shows the lock screen.
 */
export async function initLock(user, userRef) {

    currentUser = user;
    userDocRef = userRef;

    const { getDoc } = await import(
        "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
    );
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();

    lockData = data.lock || null;

    if (!lockData || !lockData.enabled) return;

    const lastUnlocked = lockData.lastUnlocked?.seconds
        ? lockData.lastUnlocked.seconds * 1000
        : 0;

    const elapsed = Date.now() - lastUnlocked;

    if (elapsed < LOCK_TIMEOUT_MS) {
        return;
    }

    showLockScreen();

}


/**
 * Force-lock the app right now. Used for "Lock now" button.
 */
export async function lockNow() {

    if (!userDocRef) return;

    try {
        const { updateDoc, serverTimestamp } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
        );
        await updateDoc(userDocRef, {
            "lock.lastUnlocked": null
        });
        showLockScreen();
    } catch (e) {
        console.error("Lock now failed:", e);
    }

}


/**
 * Save lock settings. Called from Profile page.
 */
export async function saveLockSettings(settings) {

    if (!userDocRef) throw new Error("Not signed in");

    const { updateDoc, serverTimestamp } = await import(
        "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
    );

    await updateDoc(userDocRef, {
        lock: {
            ...(lockData || {}),
            ...settings,
            updatedAt: serverTimestamp()
        }
    });

    lockData = { ...(lockData || {}), ...settings };

}


// ==================== LOCK SCREEN ====================

function showLockScreen() {

    if (overlay && document.body.contains(overlay)) {
        overlay.hidden = false;
        return;
    }

    overlay = document.createElement("div");
    overlay.className = "app-lock-overlay";
    overlay.id = "appLockOverlay";

    overlay.innerHTML = `
        <div class="app-lock-inner">

            <div class="app-lock-brand">
                <div class="app-lock-icon">
                    <i class="bx bx-lock-alt"></i>
                </div>
                <h2>Locked</h2>
                <p id="lockMessage">
                    Enter your PIN to continue
                </p>
            </div>

            <div class="app-lock-body" id="lockBody">
                <!-- Filled by JS based on mode -->
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    document.body.style.overflow = "hidden";

    if (lockData?.biometricEnabled && lockData?.biometricCredId) {
        setTimeout(() => tryBiometric(), 300);
    }

    renderPinInput();

}


function renderPinInput() {

    currentMode = "pin";

    const body = document.getElementById("lockBody");
    const msg = document.getElementById("lockMessage");

    msg.textContent = "Enter your PIN to continue";

    const pinLength = lockData?.pinLength || 6;

    body.innerHTML = `
        <div class="lock-pin-wrap">
            <input
                type="password"
                id="lockPin"
                inputmode="numeric"
                maxlength="${pinLength}"
                pattern="[0-9]*"
                autocomplete="off"
                placeholder="${"•".repeat(pinLength)}"
            >
        </div>

        <div class="lock-actions">

            ${lockData?.biometricEnabled && lockData?.biometricCredId
                ? `<button class="lock-secondary" id="lockUseBiometric" type="button">
                       <i class="bx bx-fingerprint"></i>
                       Use fingerprint
                   </button>`
                : ""}

            <button class="lock-primary" id="lockSubmit" type="button">
                <i class="bx bx-check"></i>
                Unlock
            </button>

            <button class="lock-link" id="lockForgot" type="button">
                Forgot PIN?
            </button>

        </div>
    `;

    const pinInput = document.getElementById("lockPin");

    attachEye(pinInput);

    pinInput.focus();

    pinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            document.getElementById("lockSubmit").click();
        }
    });

    document.getElementById("lockSubmit").addEventListener("click", () => {
        verifyPin(pinInput.value);
    });

    document.getElementById("lockUseBiometric")?.addEventListener("click", () => {
        tryBiometric();
    });

    document.getElementById("lockForgot").addEventListener("click", () => {
        renderRecoveryInput();
    });

}


function renderRecoveryInput() {

    currentMode = "recovery";

    const body = document.getElementById("lockBody");
    const msg = document.getElementById("lockMessage");

    msg.textContent = "Enter your recovery code";

    body.innerHTML = `
        <div class="lock-pin-wrap">
            <input
                type="text"
                id="lockRecovery"
                maxlength="9"
                autocomplete="off"
                spellcheck="false"
                placeholder="XXXX-XXXX"
                style="letter-spacing:3px; text-transform:uppercase; text-align:center;"
            >
        </div>

        <div class="lock-actions">
            <button class="lock-primary" id="lockRecoverySubmit" type="button">
                <i class="bx bx-check"></i>
                Verify recovery code
            </button>

            <button class="lock-link" id="lockBackToPin" type="button">
                ← Back to PIN
            </button>
        </div>
    `;

    const input = document.getElementById("lockRecovery");
    input.focus();

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            document.getElementById("lockRecoverySubmit").click();
        }
    });

    document.getElementById("lockRecoverySubmit").addEventListener("click", () => {
        verifyRecovery(input.value);
    });

    document.getElementById("lockBackToPin").addEventListener("click", () => {
        renderPinInput();
    });

}


async function verifyPin(pin) {

    if (!pin || pin.length < 4) {
        toast("PIN must be at least 4 digits");
        return;
    }

    const hash = await sha256(pin);

    if (hash === lockData.pinHash) {
        await unlockSuccess();
        return;
    }

    pinAttempts++;

    if (pinAttempts >= MAX_PIN_ATTEMPTS) {
        toast("Too many attempts. Use your recovery code.");
        renderRecoveryInput();
        return;
    }

    const remaining = MAX_PIN_ATTEMPTS - pinAttempts;
    toast(`Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`);

    const input = document.getElementById("lockPin");
    if (input) {
        input.value = "";
        input.focus();
    }

}


async function verifyRecovery(code) {

    if (!code) return;

    const hash = await sha256(code.toUpperCase().trim());

    if (hash === lockData.recoveryHash) {
        await startPinReset();
        return;
    }

    recoveryAttempts++;

    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        toast("Too many attempts. Signing you out...");
        setTimeout(() => {
            import("./auth.js").then((m) => m.logoutUser());
        }, 1500);
        return;
    }

    const remaining = MAX_RECOVERY_ATTEMPTS - recoveryAttempts;
    toast(`Invalid recovery code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`);

    const input = document.getElementById("lockRecovery");
    if (input) {
        input.value = "";
        input.focus();
    }

}


async function startPinReset() {

    const body = document.getElementById("lockBody");
    const msg = document.getElementById("lockMessage");

    msg.textContent = "Set a new PIN";

    const pinLength = lockData?.pinLength || 6;

    body.innerHTML = `
        <div class="lock-pin-wrap">
            <input
                type="password"
                id="newPin"
                inputmode="numeric"
                maxlength="${pinLength}"
                autocomplete="off"
                placeholder="New PIN (${pinLength} digits)"
            >
        </div>

        <div class="lock-pin-wrap">
            <input
                type="password"
                id="newPinConfirm"
                inputmode="numeric"
                maxlength="${pinLength}"
                autocomplete="off"
                placeholder="Confirm new PIN"
            >
        </div>

        <div class="lock-actions">
            <button class="lock-primary" id="saveNewPin" type="button">
                <i class="bx bx-check"></i>
                Save new PIN
            </button>
        </div>
    `;

    document.getElementById("saveNewPin").addEventListener("click", async () => {

        const pin1 = document.getElementById("newPin").value;
        const pin2 = document.getElementById("newPinConfirm").value;

        if (pin1.length !== pinLength) {
            toast(`PIN must be exactly ${pinLength} digits`);
            return;
        }

        if (pin1 !== pin2) {
            toast("PINs don't match");
            return;
        }

        const newHash = await sha256(pin1);

        await saveLockSettings({
            pinHash: newHash,
            lastUnlocked: new Date()
        });

        const { updateDoc, serverTimestamp } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
        );
        await updateDoc(userDocRef, {
            "lock.lastUnlocked": serverTimestamp()
        });

        await unlockSuccess();

    });

    attachEye(document.getElementById("newPin"));
    attachEye(document.getElementById("newPinConfirm"));

    document.getElementById("newPin").focus();

}


async function tryBiometric() {

    if (!lockData?.biometricCredId) return;

    try {

        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const credIdBytes = Uint8Array.from(
            atob(lockData.biometricCredId.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0)
        );

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                allowCredentials: [{
                    id: credIdBytes,
                    type: "public-key",
                    transports: ["internal"]
                }],
                userVerification: "required",
                timeout: 30000
            }
        });

        if (assertion) {
            await unlockSuccess();
        }

    } catch (error) {
        console.log("[Lock] Biometric not available or failed:", error.message);
    }

}


async function unlockSuccess() {

    try {
        const { updateDoc, serverTimestamp } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
        );
        await updateDoc(userDocRef, {
            "lock.lastUnlocked": serverTimestamp()
        });
    } catch (e) {
        console.warn("Failed to update lastUnlocked:", e);
    }

    pinAttempts = 0;
    recoveryAttempts = 0;

    if (overlay) {
        overlay.classList.add("hide");
        setTimeout(() => {
            overlay.remove();
            overlay = null;
            document.body.style.overflow = "";
        }, 400);
    }

    if (typeof onUnlockCallback === "function") {
        onUnlockCallback();
    }

}


// ==================== EXPORTS ====================

export { generateRecoveryCode, sha256 };
