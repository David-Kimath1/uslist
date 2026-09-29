// ==================== GREETING + LIVE CLOCK ====================

(function () {

    const greetingEl = document.getElementById("greeting");
    const clockEl = document.getElementById("liveClock");

    function updateGreeting() {

        if (!greetingEl) return;

        const h = new Date().getHours();

        let greeting = "Good evening";

        if (h >= 5 && h < 12) {
            greeting = "Good morning";
        } else if (h >= 12 && h < 17) {
            greeting = "Good afternoon";
        }

        greetingEl.textContent = greeting;

    }

    function updateClock() {

        if (!clockEl) return;

        const now = new Date();

        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");

        clockEl.textContent = `${hh}:${mm}:${ss}`;

    }

    updateGreeting();
    updateClock();

    setInterval(updateGreeting, 60000); // every minute
    setInterval(updateClock, 1000);     // every second

})();
