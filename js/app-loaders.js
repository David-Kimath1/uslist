// ==================== APP LOADERS ====================
// 1. Startup loader — plasma orb, shows briefly on page load
// 2. Update loader — shows ONLY when a genuine new version is detected

const UPDATE_NOTICE_MS = 15_000;
const PAGE_RELOAD_DELAY_MS = 1_200;


// ==================== STARTUP LOADER ====================

function injectStartupLoader() {
    if (document.getElementById("startupLoader")) return;

    const el = document.createElement("div");
    el.className = "startup-loader";
    el.id = "startupLoader";

    el.innerHTML = `
        <div class="startup-inner">
            <div class="plasma">
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <defs>
                        <mask id="clipping">
                            <polygon points="0,0 100,0 100,100 0,100" fill="black"></polygon>
                            <polygon points="25,25 75,25 50,75" fill="white"></polygon>
                            <polygon points="50,25 75,75 25,75" fill="white"></polygon>
                            <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                            <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                            <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                            <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                        </mask>
                    </defs>
                </svg>
                <div class="box"></div>
                <div class="heart-center"><i class="bx bxs-heart"></i></div>
            </div>
            <div class="startup-text">His 'n' Hers</div>
            <div class="startup-sub">Loading Our Little Universe…</div>
        </div>
    `;

    document.body.appendChild(el);
}


function hideStartupLoader() {
    const el = document.getElementById("startupLoader");
    if (!el) return;

    setTimeout(() => {
        el.classList.add("hide");
        setTimeout(() => el.remove(), 700);
    }, 900);
}


// ==================== UPDATE LOADER ====================

function injectUpdateLoader() {
    if (document.getElementById("updateLoader")) return;

    const el = document.createElement("div");
    el.className = "update-loader hide";
    el.id = "updateLoader";

    el.innerHTML = `
        <div class="main-container">
            <div class="loader">
                <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Updating">
                    <defs>
                        <linearGradient id="chipGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="var(--surface)"></stop>
                            <stop offset="100%" stop-color="var(--primary-soft)"></stop>
                        </linearGradient>
                        <linearGradient id="textGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="var(--primary-dark)"></stop>
                            <stop offset="100%" stop-color="var(--text)"></stop>
                        </linearGradient>
                        <linearGradient id="pinGradient" x1="1" y1="0" x2="0" y2="0">
                            <stop offset="0%" stop-color="var(--primary-dark)"></stop>
                            <stop offset="50%" stop-color="var(--primary)"></stop>
                            <stop offset="100%" stop-color="var(--primary-soft)"></stop>
                        </linearGradient>
                    </defs>

                    <g id="traces">
                        <path d="M100 100 H200 V210 H326" class="trace-bg"></path>
                        <path d="M100 100 H200 V210 H326" class="trace-flow purple"></path>
                        <path d="M80 180 H180 V230 H326" class="trace-bg"></path>
                        <path d="M80 180 H180 V230 H326" class="trace-flow blue"></path>
                        <path d="M60 260 H150 V250 H326" class="trace-bg"></path>
                        <path d="M60 260 H150 V250 H326" class="trace-flow yellow"></path>
                        <path d="M100 350 H200 V270 H326" class="trace-bg"></path>
                        <path d="M100 350 H200 V270 H326" class="trace-flow green"></path>
                        <path d="M700 90 H560 V210 H474" class="trace-bg"></path>
                        <path d="M700 90 H560 V210 H474" class="trace-flow blue"></path>
                        <path d="M740 160 H580 V230 H474" class="trace-bg"></path>
                        <path d="M740 160 H580 V230 H474" class="trace-flow green"></path>
                        <path d="M720 250 H590 V250 H474" class="trace-bg"></path>
                        <path d="M720 250 H590 V250 H474" class="trace-flow red"></path>
                        <path d="M680 340 H570 V270 H474" class="trace-bg"></path>
                        <path d="M680 340 H570 V270 H474" class="trace-flow yellow"></path>
                    </g>

                    <rect x="330" y="190" width="140" height="100" rx="20" ry="20"
                        fill="url(#chipGradient)" stroke="var(--border)" stroke-width="3"
                        filter="drop-shadow(0 4px 12px rgba(47,42,45,0.14))"></rect>

                    <g fill="url(#pinGradient)">
                        <rect x="322" y="205" width="8" height="10" rx="2"></rect>
                        <rect x="322" y="225" width="8" height="10" rx="2"></rect>
                        <rect x="322" y="245" width="8" height="10" rx="2"></rect>
                        <rect x="322" y="265" width="8" height="10" rx="2"></rect>
                        <rect x="470" y="205" width="8" height="10" rx="2"></rect>
                        <rect x="470" y="225" width="8" height="10" rx="2"></rect>
                        <rect x="470" y="245" width="8" height="10" rx="2"></rect>
                        <rect x="470" y="265" width="8" height="10" rx="2"></rect>
                    </g>

                    <text x="400" y="240" font-family="Arial, sans-serif" font-size="22"
                        fill="url(#textGradient)" text-anchor="middle" alignment-baseline="middle">
                        Updating
                    </text>

                    <g fill="var(--primary-dark)">
                        <circle cx="100" cy="100" r="5"></circle>
                        <circle cx="80" cy="180" r="5"></circle>
                        <circle cx="60" cy="260" r="5"></circle>
                        <circle cx="100" cy="350" r="5"></circle>
                        <circle cx="700" cy="90" r="5"></circle>
                        <circle cx="740" cy="160" r="5"></circle>
                        <circle cx="720" cy="250" r="5"></circle>
                        <circle cx="680" cy="340" r="5"></circle>
                    </g>
                </svg>
            </div>
        </div>
        <div class="update-sub">A new update is here. Installing it now…</div>
    `;

    document.body.appendChild(el);
}


function showUpdateLoader() {
    const el = document.getElementById("updateLoader");
    if (el) el.classList.remove("hide");
}


function showDashboardUpdateButton(worker, onUpdate) {
    const banner = document.getElementById("appUpdateBanner");
    const button = document.getElementById("appUpdateButton");
    if (!banner || !button || !worker) return;

    banner.hidden = false;
    button.disabled = false;
    button.onclick = () => {
        if (worker.state === "redundant") {
            banner.hidden = true;
            return;
        }

        button.disabled = true;
        banner.hidden = true;
        onUpdate(worker);
    };
}


// ==================== SERVICE WORKER UPDATE WATCH ====================

function watchForUpdates() {

    if (!("serviceWorker" in navigator)) return;

    // Skip entirely if we JUST loaded (prevents update loop on first install)
    const isFirstLoad = !sessionStorage.getItem("uslist_loaded_once");
    sessionStorage.setItem("uslist_loaded_once", "1");

    navigator.serviceWorker.ready.then((registration) => {

        // Only check for updates if the SW has been controlling
        // this page for a while — avoids the first-load loop.
        const controller = navigator.serviceWorker.controller;

        if (!controller) {
            // No active controller yet — this is a fresh install.
            // Do nothing. The SW will be ready next visit.
            console.log("[SW] Fresh install — skipping update check this load.");
            return;
        }

        // If we just reloaded because of an update, don't loop again.
        if (isFirstLoad === false && sessionStorage.getItem("uslist_just_updated")) {
            console.log("[SW] Just updated — skipping re-check.");
            sessionStorage.removeItem("uslist_just_updated");
            return;
        }

        let updateStarted = false;

        function activateUpdate(worker) {
            if (!worker || updateStarted) return;

            updateStarted = true;
            showUpdateLoader();
            sessionStorage.setItem("uslist_just_updated", "1");

            setTimeout(() => {
                worker.postMessage({ type: "SKIP_WAITING" });
            }, UPDATE_NOTICE_MS - PAGE_RELOAD_DELAY_MS);
        }

        function offerUpdate(worker) {
            if (!worker || updateStarted) return;

            showDashboardUpdateButton(worker, activateUpdate);
        }

        function watchInstallingWorker(worker) {
            if (!worker) return;

            const activateIfInstalled = () => {
                if (
                    worker.state === "installed" &&
                    navigator.serviceWorker.controller
                ) {
                    offerUpdate(worker);
                }
            };

            worker.addEventListener("statechange", activateIfInstalled);
            activateIfInstalled();
        }

        // Listen before checking so a fast update cannot be missed.
        registration.addEventListener("updatefound", () => {
            watchInstallingWorker(registration.installing);
        });

        // A worker may already be waiting if the page loaded while offline
        // or before the update watcher attached its listeners.
        if (registration.waiting) {
            offerUpdate(registration.waiting);
        } else {
            watchInstallingWorker(registration.installing);
        }

        // Check on every app launch so installed PWAs pick up deployments
        // without requiring users to force-refresh the page.
        registration.update().catch(() => {});

        // ---- PERIODIC UPDATE CHECKS ----

        // 1. Every 30 minutes while open (NOT on every page load)
        setInterval(() => {
            registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // 2. When the tab regains focus (but not more than once per minute)
        let lastFocusCheck = 0;
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                const now = Date.now();
                if (now - lastFocusCheck > 60 * 1000) {
                    lastFocusCheck = now;
                    registration.update().catch(() => {});
                }
            }
        });

        // 3. When the network reconnects
        window.addEventListener("online", () => {
            registration.update().catch(() => {});
        });


    });


    // ---- RELOAD ONCE WHEN NEW SW TAKES OVER ----

    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {

        if (refreshing) return;
        refreshing = true;

        // Only reload if we were showing the update loader.
        const loader = document.getElementById("updateLoader");
        const isShowing = loader && !loader.classList.contains("hide");

        if (!isShowing) {
            // The SW changed for some reason we didn't trigger.
            // Don't reload — just let it take effect next visit.
            return;
        }

        setTimeout(() => {
            window.location.reload();
        }, PAGE_RELOAD_DELAY_MS);

    });

}


// ==================== BOOT ====================

injectStartupLoader();
injectUpdateLoader();

window.addEventListener("load", hideStartupLoader);

// Kick off the update watcher AFTER the page is fully settled
setTimeout(watchForUpdates, 3000);
