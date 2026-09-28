// ==================== SLIDE-IN NOTIFICATION BANNER ====================

const STACK_LIMIT = 3;
const AUTO_DISMISS_MS = 5000;


// ==================== STATE ====================

let stackEl = null;


// ==================== INIT ====================

function ensureStack() {

    if (stackEl && document.body.contains(stackEl)) return stackEl;

    stackEl = document.createElement("div");
    stackEl.className = "notify-banner-stack";
    document.body.appendChild(stackEl);

    return stackEl;

}


// ==================== PUBLIC: SHOW BANNER ====================

export function showBanner(notification) {

    // Only when the tab is focused. If unfocused, the OS
    // notification already handles it.
    if (!document.hasFocus()) return;

    const stack = ensureStack();

    // Cap the stack
    while (stack.children.length >= STACK_LIMIT) {
        stack.firstElementChild.remove();
    }

    const el = document.createElement("div");
    el.className = "notify-banner";

    const who = prettyName(notification.fromUsername);
    const { title, body, icon, link } = describe(notification, who);

    el.innerHTML = `
        <div class="notify-banner-icon">
            <i class="bx ${icon}"></i>
        </div>

        <div class="notify-banner-body">
            <strong>${escapeHTML(title)}</strong>
            ${body ? `<p>${escapeHTML(body)}</p>` : ""}
        </div>

        <button
            class="notify-banner-close"
            aria-label="Dismiss"
            type="button"
        >
            <i class="bx bx-x"></i>
        </button>
    `;

    // Click anywhere except the X → navigate
    el.addEventListener("click", (event) => {
        if (event.target.closest(".notify-banner-close")) return;

        if (link) {
            window.location.href = link;
        }
    });

    el.querySelector(".notify-banner-close")
        .addEventListener("click", (event) => {
            event.stopPropagation();
            dismiss(el);
        });

    stack.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
        el.classList.add("show");
    });

    // Auto dismiss
    setTimeout(() => dismiss(el), AUTO_DISMISS_MS);

    // Play system notification sound
    playSystemSound(title, body);

}


// ==================== DISMISS ====================

function dismiss(el) {

    if (!el || !el.parentNode) return;

    el.classList.remove("show");
    el.classList.add("hiding");

    setTimeout(() => {
        if (el.parentNode) el.remove();
    }, 300);

}


// ==================== DEVICE SOUND ====================

function playSystemSound(title, body) {

    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
        // A silent flag is NOT set, so the OS plays its default sound.
        // Most browsers require the tab to be focused + user to have
        // interacted with the page at least once per session.
        const n = new Notification(title, {
            body: body || "",
            silent: false,
            tag: "uslist-banner-sound"
        });

        // Immediately close so it doesn't appear twice
        // (the on-screen banner already shows it)
        setTimeout(() => n.close(), 50);

        n.onclick = () => window.focus();

    } catch (error) {
        // Browsers may block this. Silent failure.
    }

}


// ==================== DESCRIBE ====================

function describe(n, who) {

    const inPages = location.pathname.includes("/pages/");
    const prefix = inPages ? "" : "pages/";

    switch (n.type) {

        case "item_added":
            return {
                title: `${who} added a new item`,
                body: n.itemTitle || "",
                icon: "bx-plus-circle",
                link: prefix + "bucket-list.html"
            };

        case "item_completed":
            return {
                title: `${who} completed an item`,
                body: n.itemTitle || "",
                icon: "bx-check-circle",
                link: prefix + "bucket-list.html"
            };

        case "date_reminder_week":
            return {
                title: `${n.itemTitle || "A date"} is in one week`,
                body: "Mark your calendar",
                icon: "bx-calendar-heart",
                link: prefix + "dates.html"
            };

        case "date_reminder_today":
            return {
                title: `${n.itemTitle || "A date"} is today`,
                body: "Don't forget",
                icon: "bx-calendar-heart",
                link: prefix + "dates.html"
            };

        case "cycle_started":
            return {
                title: `${who} logged a new cycle`,
                body: n.itemTitle || "",
                icon: "bx-pulse",
                link: prefix + "cycle.html"
            };

        case "memory_added":
            return {
                title: `${who} saved a memory`,
                body: n.itemTitle || "",
                icon: "bx-image-add",
                link: prefix + "memories.html"
            };

        default:
            return {
                title: `New from ${who}`,
                body: n.itemTitle || "",
                icon: "bx-bell",
                link: prefix + "timeline.html"
            };

    }

}


// ==================== HELPERS ====================

function prettyName(username) {

    if (!username) return "Your partner";

    const cleaned = username.replace(/[_-]+/g, " ");

    return cleaned
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

}

function escapeHTML(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

}
