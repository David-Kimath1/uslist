// ==================== PIN EYE TOGGLE ====================
// Wraps a password input with a small eye button to show/hide.

export function attachEye(input) {

    if (!input || input.dataset.eyeAttached === "1") return;
    input.dataset.eyeAttached = "1";

    // Wrap input in a relative container
    const wrap = document.createElement("div");
    wrap.className = "pin-input-wrap";

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pin-eye";
    btn.setAttribute("aria-label", "Show PIN");
    btn.innerHTML = '<i class="bx bx-show"></i>';

    wrap.appendChild(btn);

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.innerHTML = showing
            ? '<i class="bx bx-show"></i>'
            : '<i class="bx bx-hide"></i>';
        btn.setAttribute("aria-label", showing ? "Show PIN" : "Hide PIN");
        input.focus();
    });

}
