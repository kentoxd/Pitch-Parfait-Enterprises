export function money(n) {
  const num = Number(n || 0);
  return `₱${num.toFixed(2)}`;
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function showToast(message, variant = "success") {
  const host = document.createElement("div");
  host.className = "pp-toast";
  host.innerHTML = `
    <div class="toast align-items-center text-bg-${variant} border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>
      </div>
    </div>
  `;
  document.body.appendChild(host);

  const btn = host.querySelector(".btn-close");
  const remove = () => host.remove();
  btn.addEventListener("click", remove);
  setTimeout(remove, 3400);
}

export function setPressed(el, pressed) {
  el.setAttribute("aria-pressed", pressed ? "true" : "false");
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

