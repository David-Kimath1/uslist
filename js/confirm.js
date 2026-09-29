// ==================== CONFIRM DIALOG ====================
// Promise-based replacement for window.confirm().

export function confirmDialog({
    title = "Are you sure?",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",     // "danger" | "primary"
    icon = "bx-error-circle"
} = {}) {

    return new Promise((resolve) => {

        const overlay = document.createElement("div");
        overlay.className = "confirm-overlay";

        overlay.innerHTML = `
            <div class="confirm-card" role="dialog" aria-modal="true">
                <div class="confirm-icon">
                    <i class="bx ${icon}"></i>
                </div>
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="confirm-btn cancel" type="button" data-act="cancel">
                        ${cancelText}
                    </button>
                    <button class="confirm-btn ${variant}" type="button" data-act="ok">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Trigger enter animation
        requestAnimationFrame(() => overlay.classList.add("show"));

        const finish = (result) => {
            overlay.classList.remove("show");
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 220);
        };

        overlay.querySelector('[data-act="cancel"]').onclick = () => finish(false);
        overlay.querySelector('[data-act="ok"]').onclick = () => finish(true);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) finish(false);
        });

        document.addEventListener("keydown", function esc(e) {
            if (e.key === "Escape") {
                document.removeEventListener("keydown", esc);
                finish(false);
            }
        });

        // Focus the cancel button by default (safer)
        overlay.querySelector('[data-act="cancel"]').focus();

    });

}
