import { isFirebaseConfigured } from "../lib/firebase.js";
import { getOrder, updateOrder, clearCart } from "./store.js";
import { escapeHtml, money, showToast } from "./ui.js";
import { requireAuthOrRedirect } from "./auth.js";

function getOrderId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("orderId");
}

function renderLines(order) {
  const host = document.getElementById("pp-pay-lines");
  const items = Array.isArray(order.items) ? order.items : [];
  const take = items.slice(0, 6);
  host.innerHTML = take
    .map((it) => {
      const qty = Number(it.quantity) || 0;
      const lineTotal = (Number(it.price) || 0) * qty;
      return `
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div>
            <div class="small fw-semibold">${escapeHtml(it.name || "")}</div>
            <div class="pp-muted small">Qty: ${qty}</div>
          </div>
          <div class="small fw-semibold">${money(lineTotal)}</div>
        </div>
      `;
    })
    .join("");
}

async function boot() {
  if (!(await requireAuthOrRedirect(window.location.pathname + window.location.search))) return;
  const orderId = getOrderId();
  const warn = document.getElementById("pp-pay-warning");

  if (!isFirebaseConfigured() || !orderId) {
    warn.classList.remove("d-none");
    document.getElementById("pp-confirm").setAttribute("disabled", "disabled");
    return;
  }

  const order = await getOrder(orderId);
  if (!order) {
    warn.classList.remove("d-none");
    document.getElementById("pp-confirm").setAttribute("disabled", "disabled");
    return;
  }

  document.getElementById("pp-amount").textContent = money(order.totalAmount || 0);
  document.getElementById("pp-pay-total").textContent = money(order.totalAmount || 0);
  renderLines(order);

  document.getElementById("pp-pay-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("pp-pay-name").value.trim();
    const ref = document.getElementById("pp-pay-ref").value.trim();
    if (!name || !ref) return;

    try {
      await updateOrder(orderId, {
        status: "paid",
        payerName: name,
        paymentReference: ref
      });
      await clearCart();
      showToast("Your order has been placed successfully!", "success");
      setTimeout(() => (window.location.href = "./home.html"), 1200);
    } catch {
      showToast("Payment confirmation failed. Check Firestore rules.", "danger");
    }
  });
}

boot();

