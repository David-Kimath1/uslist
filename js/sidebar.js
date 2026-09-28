// ==================== UNIVERSAL SIDEBAR TOGGLE ====================

(function () {

    const menuButton = document.getElementById("menuButton");
    const sidebar = document.getElementById("sidebar");
    const sidebarClose = document.getElementById("sidebarClose");

    if (!sidebar) return;

    function open() {
        sidebar.classList.add("open");
        document.body.classList.add("sidebar-open");
    }

    function close() {
        sidebar.classList.remove("open");
        document.body.classList.remove("sidebar-open");
    }

    menuButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        open();
    });

    sidebarClose?.addEventListener("click", close);

    // Click the backdrop to close
    document.addEventListener("click", (event) => {
        if (
            window.innerWidth <= 900 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            (!menuButton || !menuButton.contains(event.target))
        ) {
            close();
        }
    });

    // Escape closes
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && sidebar.classList.contains("open")) {
            close();
        }
    });

    // Close when navigating
    sidebar.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", close);
    });

})();
