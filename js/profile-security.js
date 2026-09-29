import { auth, db } from "../firebase/config.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    generateRecoveryCode,
    sha256,
    lockNow
} from "./app-lock.js";

import {
    toastSuccess,
    toastError,
    toastInfo,
    toastWarning
} from "./toast.js";

import { confirmDialog } from "./confirm.js";

import { attachEye } from "./pin-eye.js";


let currentUser = null;
let userDocRef = null;
let lockData = null;


const toggle = document.getElementById("lockEnabled");
const recoverySection = document.getElementById("recoverySection");
const recoveryCodeDisplay = document.getElementById("recoveryCodeDisplay");
const copyRecoveryBtn = document.getElementById("copyRecoveryBtn");
const changePinBtn = document.getElementById("changePinBtn");
const biometricBtn = document.getElementById("biometricBtn");
const lockNowBtn = document.getElementById("lockNowBtn");


auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    currentUser = user;
    userDocRef = doc(db, "users", user.uid);

    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return;

    lockData = snap.data().lock || null;

    renderState();

});


function renderState() {

    const enabled = !!(lockData?.enabled);

    if (toggle) toggle.checked = enabled;
    if (recoverySection) recoverySection.hidden = !enabled;

    if (enabled && lockData?.recoveryCode && recoveryCodeDisplay) {
        recoveryCodeDisplay.textContent = lockData.recoveryCode;
    }

    if (changePinBtn) changePinBtn.hidden = !enabled;
    if (lockNowBtn) lockNowBtn.hidden = !enabled;

    const supportsBiometric =
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function";

    if (biometricBtn) {
        if (enabled && supportsBiometric) {
            biometricBtn.hidden = false;
            biometricBtn.innerHTML = lockData?.biometricEnabled
                ? '<i class="bx bx-fingerprint"></i> Disable Fingerprint'
                : '<i class="bx bx-fingerprint"></i> Enable Fingerprint';
        } else {
            biometricBtn.hidden = true;
        }
    }

}


toggle?.addEventListener("change", async () => {

    if (toggle.checked) {
        toggle.checked = false;
        openPinSetup();
    } else {
        const ok = await confirmDialog({
            title: "Disable App Lock?",
            message: "Your PIN and recovery code will be removed. You can set them up again anytime.",
            confirmText: "Disable",
            cancelText: "Keep it on",
            variant: "danger",
            icon: "bx-lock-open-alt"
        });

        if (!ok) {
            toggle.checked = true;
            return;
        }

        await disableLock();
    }

});


async function disableLock() {

    try {
        await updateDoc(userDocRef, { lock: null });
        lockData = null;
        renderState();
        toastSuccess("App lock disabled");
    } catch (error) {
        console.error(error);
        toastError("Could not disable lock");
    }

}


function openPinSetup(isChange = false) {

    const existing = document.getElementById("pinSetupModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal-overlay show";
    modal.id = "pinSetupModal";

    modal.innerHTML = `
        <div class="modal" style="max-width:420px;">
            <div class="modal-header">
                <div>
                    <span class="panel-eyebrow">${isChange ? "CHANGE PIN" : "SET UP LOCK"}</span>
                    <h3>${isChange ? "Choose a new PIN" : "Choose a PIN"}</h3>
                </div>
                <button class="modal-close" id="closePinSetup" type="button">
                    <i class="bx bx-x"></i>
                </button>
            </div>

            <div class="form-group">
                <label>PIN length</label>
                <div class="pin-length-options">
                    <label class="pin-length-option">
                        <input type="radio" name="pinLen" value="4">
                        <span>4 digits</span>
                    </label>
                    <label class="pin-length-option">
                        <input type="radio" name="pinLen" value="6" checked>
                        <span>6 digits</span>
                    </label>
                </div>
            </div>

            <div class="form-group">
                <label for="pinInput1">Enter PIN</label>
                <input type="password" id="pinInput1" inputmode="numeric" maxlength="6" autocomplete="off">
            </div>

            <div class="form-group">
                <label for="pinInput2">Confirm PIN</label>
                <input type="password" id="pinInput2" inputmode="numeric" maxlength="6" autocomplete="off">
            </div>

            <div class="form-actions">
                <button class="secondary-button" id="cancelPinSetup" type="button">Cancel</button>
                <button class="primary-button" id="savePinBtn" type="button">
                    <i class="bx bx-lock-alt"></i>
                    Save PIN
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById("closePinSetup").onclick = close;
    document.getElementById("cancelPinSetup").onclick = close;

    modal.addEventListener("click", (e) => {
        if (e.target === modal) close();
    });

    document.getElementById("savePinBtn").onclick = savePin;

    attachEye(document.getElementById("pinInput1"));
    attachEye(document.getElementById("pinInput2"));

    document.getElementById("pinInput1").focus();

}


async function savePin() {

    const pinLen = parseInt(
        document.querySelector('input[name="pinLen"]:checked').value,
        10
    );

    const pin1 = document.getElementById("pinInput1").value;
    const pin2 = document.getElementById("pinInput2").value;

    if (pin1.length !== pinLen) {
        toastError(`PIN must be exactly ${pinLen} digits`);
        return;
    }

    if (!/^\d+$/.test(pin1)) {
        toastError("PIN must contain only numbers");
        return;
    }

    if (pin1 !== pin2) {
        toastError("PINs don't match");
        return;
    }

    const pinHash = await sha256(pin1);
    const recoveryCode = lockData?.recoveryCode || generateRecoveryCode();
    const recoveryHash = await sha256(recoveryCode);

    try {

        await updateDoc(userDocRef, {
            lock: {
                enabled: true,
                pinLength: pinLen,
                pinHash: pinHash,
                recoveryCode: recoveryCode,
                recoveryHash: recoveryHash,
                biometricEnabled: lockData?.biometricEnabled || false,
                biometricCredId: lockData?.biometricCredId || null,
                lastUnlocked: serverTimestamp(),
                updatedAt: serverTimestamp()
            }
        });

        const snap = await getDoc(userDocRef);
        lockData = snap.data().lock || null;

        document.getElementById("pinSetupModal")?.remove();
        renderState();
        toastSuccess("PIN saved. Save your recovery code!");

    } catch (error) {
        console.error(error);
        toastError("Could not save PIN");
    }

}


changePinBtn?.addEventListener("click", () => openPinSetup(true));


copyRecoveryBtn?.addEventListener("click", async () => {
    const code = recoveryCodeDisplay.textContent.trim();
    if (!code) return;
    try {
        await navigator.clipboard.writeText(code);
        toastSuccess("Recovery code copied");
    } catch (e) {
        toastError("Could not copy");
    }
});


biometricBtn?.addEventListener("click", async () => {

    if (lockData?.biometricEnabled) {
        try {
            await updateDoc(userDocRef, {
                "lock.biometricEnabled": false,
                "lock.biometricCredId": null
            });
            lockData.biometricEnabled = false;
            lockData.biometricCredId = null;
            renderState();
            toastSuccess("Fingerprint disabled");
        } catch (e) {
            toastError("Could not disable");
        }
        return;
    }

    try {

        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            toastWarning("This device doesn't support fingerprint");
            return;
        }

        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge,
                rp: { name: "His 'n' Hers", id: window.location.hostname },
                user: {
                    id: new TextEncoder().encode(currentUser.uid),
                    name: currentUser.email || "user",
                    displayName: "His 'n' Hers"
                },
                pubKeyCredParams: [
                    { type: "public-key", alg: -7 },
                    { type: "public-key", alg: -257 }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required"
                },
                timeout: 60000,
                attestation: "none"
            }
        });

        if (!credential) {
            toastWarning("Fingerprint setup cancelled");
            return;
        }

        const credIdB64 = btoa(
            String.fromCharCode(...new Uint8Array(credential.rawId))
        )
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        await updateDoc(userDocRef, {
            "lock.biometricEnabled": true,
            "lock.biometricCredId": credIdB64
        });

        lockData.biometricEnabled = true;
        lockData.biometricCredId = credIdB64;

        renderState();
        toastSuccess("Fingerprint enabled");

    } catch (error) {
        console.error("Biometric error:", error);
        toastError("Could not set up fingerprint");
    }

});


lockNowBtn?.addEventListener("click", async () => {
    await lockNow();
    toastInfo("App locked");
});
