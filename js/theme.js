// ==================== THEME (System / Light / Dark) ====================

const STORAGE_KEY = "uslist_theme";


// ==================== APPLY ====================

function systemPrefersDark() {
    return window.matchMedia &&
           window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(mode) {
    // mode: "system" | "light" | "dark"
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(mode) {

    const resolved = resolveTheme(mode);

    document.documentElement.setAttribute("data-theme", resolved);

    // Also set the browser chrome color (mobile address bar)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute(
            "content",
            resolved === "dark" ? "#1a1417" : "#f8f6f4"
        );
    }

    // Update icon on toggle button if present
    updateToggleIcon(mode);

}


// ==================== STORAGE ====================

function getSavedMode() {
    return localStorage.getItem(STORAGE_KEY) || "system";
}

function saveMode(mode) {
    localStorage.setItem(STORAGE_KEY, mode);
}


// ==================== INIT (run immediately) ====================

const initialMode = getSavedMode();
applyTheme(initialMode);


// React to system changes if mode is "system"
if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener(
        "change",
        () => {
            if (getSavedMode() === "system") {
                applyTheme("system");
            }
        }
    );
}


// ==================== TOGGLE ====================

function cycleMode() {

    const current = getSavedMode();

    const next = current === "system"
        ? "light"
        : current === "light"
        ? "dark"
        : "system";

    saveMode(next);
    applyTheme(next);

}


// ==================== TOGGLE BUTTON ====================

function updateToggleIcon(mode) {

    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    const icon = btn.querySelector("i");
    if (!icon) return;

    if (mode === "system") {
        icon.className = "bx bx-desktop";
        btn.title = "Theme: System";
    } else if (mode === "light") {
        icon.className = "bx bx-sun";
        btn.title = "Theme: Light";
    } else {
        icon.className = "bx bx-moon";
        btn.title = "Theme: Dark";
    }

}


// ==================== INJECT TOGGLE INTO HEADER ====================

function injectToggle() {

    const headerActions = document.querySelector(".header-actions");
    if (!headerActions) return;

    if (document.getElementById("themeToggle")) return;

    const btn = document.createElement("button");
    btn.className = "icon-button theme-toggle";
    btn.id = "themeToggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle theme");
    btn.innerHTML = '<i class="bx bx-desktop"></i>';

    btn.addEventListener("click", cycleMode);

    // Insert before the profile button
    const profileBtn = headerActions.querySelector(".profile-button");
    if (profileBtn) {
        headerActions.insertBefore(btn, profileBtn);
    } else {
        headerActions.appendChild(btn);
    }

    updateToggleIcon(getSavedMode());

}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectToggle);
} else {
    injectToggle();
}
