(function () {

    const el = document.getElementById("greeting");
    if (!el) return;

    const h = new Date().getHours();

    let greeting = "Good evening";

    if (h >= 5 && h < 12) {
        greeting = "Good morning";
    } else if (h >= 12 && h < 17) {
        greeting = "Good afternoon";
    }

    el.textContent = greeting;

})();
