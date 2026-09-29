// ==================== APP LOADERS ====================
// 1. Startup loader — plasma orb, shows briefly on page load
// 2. Update loader — shows ONLY when a genuine new version is detected


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
        <div class="loader">
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="text"><span>Updating</span></div>
            <div class="line"></div>
        </div>
        <div class="update-sub">Getting your new features ready</div>
    `;

    document.body.appendChild(el);
}


function showUpdateLoader() {
    const el = document.getElementById("updateLoader");
    if (el) el.classList.remove("hide");
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


        // ---- DETECT NEW VERSION ----

        registration.addEventListener("updatefound", () => {

            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {

                if (
                    newWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                ) {
                    // Genuine new version detected — show loader, activate
                    console.log("[SW] New version ready — updating.");

                    sessionStorage.setItem("uslist_just_updated", "1");

                    showUpdateLoader();

                    setTimeout(() => {
                        newWorker.postMessage({ type: "SKIP_WAITING" });
                    }, 1500);
                }

            });

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
        }, 1200);

    });

}


// ==================== BOOT ====================

injectStartupLoader();
injectUpdateLoader();

window.addEventListener("load", hideStartupLoader);

// Kick off the update watcher AFTER the page is fully settled
setTimeout(watchForUpdates, 3000);
