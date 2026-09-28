// ==================== BROWSER PUSH NOTIFICATIONS ====================
// Fires a browser notification when a new partner notification
// arrives while the tab is unfocused.

const STORAGE_KEY = "uslist_push_dismissed";


// ==================== PERMISSION ====================

export function pushSupported() {
    return "Notification" in window;
}

export function pushPermission() {
    return pushSupported() ? Notification.permission : "unsupported";
}

export function pushDismissed() {
    return localStorage.getItem(STORAGE_KEY) === "1";
}

export function dismissPushPrompt() {
    localStorage.setItem(STORAGE_KEY, "1");
}

export async function requestPushPermission() {

    if (!pushSupported()) return "unsupported";

    try {
        const result = await Notification.requestPermission();
        return result;
    } catch (error) {
        console.warn("Push permission error:", error);
        return "denied";
    }

}


// ==================== SHOW POPUP ====================

export function showPush(title, body) {

    if (!pushSupported()) return;
    if (Notification.permission !== "granted") return;

    // Only pop when the tab is NOT focused
    if (document.hasFocus()) return;

    try {

        const n = new Notification(title, {
            body,
            icon: "../assets/icons/icon-192.png",
            badge: "../assets/icons/icon-192.png",
            tag: "uslist-notif-" + Date.now(),
            renotify: true
        });

        n.onclick = () => {
            window.focus();
            n.close();
        };

    } catch (error) {
        console.warn("Push show error:", error);
    }

}


// ==================== PROMPT UI ====================

export function buildPushPrompt(onEnable) {

    if (!pushSupported()) return;

    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") return;
    if (pushDismissed()) return;

    // Don't stack prompts
    if (document.getElementById("pushPromptBanner")) return;

    const banner = document.createElement("div");
    banner.className = "push-prompt";
    banner.id = "pushPromptBanner";

    banner.innerHTML = `
        <div class="push-prompt-icon">
            <i class="bx bx-bell"></i>
        </div>

        <div class="push-prompt-body">
            <strong>Get notified when they add something?</strong>
            <p>We'll ping you here, even if you're on another tab.</p>
        </div>

        <div class="push-prompt-actions">
            <button
                class="push-prompt-later"
                type="button"
            >
                Not now
            </button>

            <button
                class="push-prompt-enable"
                type="button"
            >
                <i class="bx bx-check"></i>
                Enable
            </button>
        </div>
    `;

    // Insert at top of main
    const main = document.querySelector(".main") || document.body;

    const header = main.querySelector(".header");

    if (header) {
        header.insertAdjacentElement("afterend", banner);
    } else {
        main.prepend(banner);
    }

    banner.querySelector(".push-prompt-later").addEventListener(
        "click",
        () => {
            dismissPushPrompt();
            banner.remove();
        }
    );

    banner.querySelector(".push-prompt-enable").addEventListener(
        "click",
        async () => {
            const result = await requestPushPermission();
            banner.remove();

            if (result === "granted" && typeof onEnable === "function") {
                onEnable();
            }
        }
    );

}
