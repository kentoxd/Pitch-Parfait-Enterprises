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
  document.getElementById("pp-method-delivery").textContent = order.deliveryMethod || "-";
  document.getElementById("pp-method-payment").textContent =
    order.paymentMethod === "online" ? "online (dummy)" : (order.paymentMethod || "cod");
  renderLines(order);

  const isDelivery = order.deliveryMethod === "delivery";
  const isOnline = order.paymentMethod === "online";
  const addressWrap = document.getElementById("pp-pay-address-wrap");
  const pickupWrap = document.getElementById("pp-pay-pickup-note-wrap");
  const refWrap = document.getElementById("pp-pay-ref-wrap");
  const addressInput = document.getElementById("pp-pay-address");
  const refInput = document.getElementById("pp-pay-ref");
  if (isDelivery) {
    addressWrap.classList.remove("d-none");
    pickupWrap.classList.add("d-none");
    addressInput.setAttribute("required", "required");
  } else {
    addressWrap.classList.add("d-none");
    pickupWrap.classList.remove("d-none");
    addressInput.removeAttribute("required");
  }
  if (isOnline) {
    refWrap.classList.remove("d-none");
    refInput.setAttribute("required", "required");
  } else {
    refWrap.classList.add("d-none");
    refInput.removeAttribute("required");
  }

  const existingCustomer = order.customer || {};
  document.getElementById("pp-pay-name").value = existingCustomer.name || "";
  document.getElementById("pp-pay-phone").value = existingCustomer.phone || "";
  document.getElementById("pp-pay-address").value = existingCustomer.address || "";
  document.getElementById("pp-pay-pickup-note").value = existingCustomer.pickupNote || "";
  document.getElementById("pp-pay-ref").value = order.paymentReference || "";

  document.getElementById("pp-pay-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("pp-pay-name").value.trim();
    const phone = document.getElementById("pp-pay-phone").value.trim();
    const address = document.getElementById("pp-pay-address").value.trim();
    const pickupNote = document.getElementById("pp-pay-pickup-note").value.trim();
    const ref = document.getElementById("pp-pay-ref").value.trim();
    if (!name || !phone) return;
    if (isDelivery && !address) return;
    if (isOnline && !ref) return;

    try {
      await updateOrder(orderId, {
        status: isOnline ? "paid" : "placed",
        payerName: name,
        paymentReference: isOnline ? ref : "",
        customer: {
          name,
          phone,
          address: isDelivery ? address : "",
          pickupNote: isDelivery ? "" : pickupNote
        }
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

