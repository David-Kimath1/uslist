// ==================== IN-APP TOAST ====================
// Professional replacement for alert(). Slides in from top-center.

let container = null;


function ensureContainer() {

    if (container && document.body.contains(container)) return container;

    container = document.createElement("div");
    container.className = "toast-stack";
    document.body.appendChild(container);

    return container;

}


export function toast(message, type = "info", duration = 3600) {

    const stack = ensureContainer();

    const el = document.createElement("div");
    el.className = `toast toast-${type}`;

    const icon = {
        info: "bx-info-circle",
        success: "bx-check-circle",
        warning: "bx-error",
        error: "bx-error-circle"
    }[type] || "bx-info-circle";

    el.innerHTML = `
        <i class="bx ${icon}"></i>
        <span>${escapeHTML(message)}</span>
    `;

    stack.appendChild(el);

    requestAnimationFrame(() => el.classList.add("show"));

    setTimeout(() => {
        el.classList.remove("show");
        el.classList.add("hiding");
        setTimeout(() => el.remove(), 300);
    }, duration);

}


export function toastSuccess(message) { toast(message, "success"); }
export function toastError(message)   { toast(message, "error"); }
export function toastWarning(message) { toast(message, "warning"); }
export function toastInfo(message)    { toast(message, "info"); }


function escapeHTML(value) {

    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;

}
