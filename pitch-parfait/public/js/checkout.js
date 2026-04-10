import { isFirebaseConfigured } from "../lib/firebase.js";
import { getProducts, getCartLines, createOrder, clearCart } from "./store.js";
import { escapeHtml, money, setPressed, showToast } from "./ui.js";
import { requireAuthOrRedirect } from "./auth.js";

let deliveryMethod = null; // "pickup" | "delivery"
let paymentMethod = null; // "cod" | "online"
let products = [];
let cartLines = [];

function collectCustomerDetails() {
  return {
    name: document.getElementById("pp-customer-name").value.trim(),
    phone: document.getElementById("pp-customer-phone").value.trim(),
    address: document.getElementById("pp-customer-address").value.trim(),
    pickupNote: document.getElementById("pp-pickup-note").value.trim(),
  };
}

function updateCustomerFieldsVisibility() {
  const deliveryWrap = document.getElementById("pp-delivery-address-wrap");
  const pickupWrap = document.getElementById("pp-pickup-note-wrap");
  const addressInput = document.getElementById("pp-customer-address");

  if (deliveryMethod === "delivery") {
    deliveryWrap.classList.remove("d-none");
    pickupWrap.classList.add("d-none");
    addressInput.setAttribute("required", "required");
  } else if (deliveryMethod === "pickup") {
    deliveryWrap.classList.add("d-none");
    pickupWrap.classList.remove("d-none");
    addressInput.removeAttribute("required");
  } else {
    deliveryWrap.classList.add("d-none");
    pickupWrap.classList.add("d-none");
    addressInput.removeAttribute("required");
  }
}

function isCustomerDetailsValid() {
  const d = collectCustomerDetails();
  if (!d.name || !d.phone) return false;
  if (deliveryMethod === "delivery" && !d.address) return false;
  return true;
}

function allowedPayments() {
  if (deliveryMethod === "pickup") return ["cod"];
  if (deliveryMethod === "delivery") return ["cod", "online"];
  return [];
}

function renderPaymentOptions() {
  const host = document.getElementById("pp-payment-options");
  const allowed = allowedPayments();
  if (!allowed.includes(paymentMethod)) paymentMethod = null;

  const option = (key, title, subtitle) => {
    const pressed = paymentMethod === key;
    return `
      <div class="col-12 col-md-6">
        <button class="pp-option w-100 text-start" type="button" data-pay="${key}" aria-pressed="${pressed ? "true" : "false"}">
          <div class="fw-semibold">${escapeHtml(title)}</div>
          <div class="pp-muted small">${escapeHtml(subtitle)}</div>
        </button>
      </div>
    `;
  };

  host.innerHTML = [
    allowed.includes("cod") ? option("cod", "Cash on Delivery (COD)", "Pay when you receive it.") : "",
    allowed.includes("online") ? option("online", "Online Payment (Dummy)", "Proceed to a mock payment form.") : ""
  ].join("");

  host.querySelectorAll("[data-pay]").forEach((btn) => {
    btn.addEventListener("click", () => {
      paymentMethod = btn.getAttribute("data-pay");
      qUpdatePressed(host, "data-pay", paymentMethod);
      updatePlaceOrderState();
    });
  });
}

function qUpdatePressed(root, attr, selected) {
  root.querySelectorAll(`[${attr}]`).forEach((el) => setPressed(el, el.getAttribute(attr) === selected));
}

function renderSummary() {
  const host = document.getElementById("pp-summary-lines");
  const take = cartLines.slice(0, 5);
  host.innerHTML = take
    .map((l) => {
      const p = products.find((x) => x.id === l.productId);
      if (!p) return "";
      return `
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div>
            <div class="small fw-semibold">${escapeHtml(p.name)}</div>
            <div class="pp-muted small">Qty: ${Number(l.quantity) || 0}</div>
          </div>
          <div class="small fw-semibold">${money((Number(p.price) || 0) * (Number(l.quantity) || 0))}</div>
        </div>
      `;
    })
    .join("");

  const total = cartLines.reduce((sum, l) => {
    const p = products.find((x) => x.id === l.productId);
    if (!p) return sum;
    return sum + (Number(p.price) || 0) * (Number(l.quantity) || 0);
  }, 0);
  document.getElementById("pp-summary-total").textContent = money(total);
  return total;
}

function updatePlaceOrderState() {
  const btn = document.getElementById("pp-place-order");
  const hint = document.getElementById("pp-place-hint");
  const ok = Boolean(deliveryMethod && paymentMethod && isCustomerDetailsValid());
  btn.disabled = !ok;
  hint.textContent = ok
    ? "Ready to place your order."
    : "Select delivery/payment and complete customer details.";
}

async function placeOrder(totalAmount) {
  if (!isFirebaseConfigured()) {
    showToast("Firebase config missing. Can't save orders yet.", "warning");
    return;
  }
  const items = cartLines
    .map((l) => {
      const p = products.find((x) => x.id === l.productId);
      if (!p) return null;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: p.image,
        description: p.description,
        quantity: Number(l.quantity) || 0
      };
    })
    .filter(Boolean);

  const order = {
    items,
    totalAmount,
    deliveryMethod,
    paymentMethod: paymentMethod === "online" ? "online" : "cod",
    status: paymentMethod === "online" ? "pendingPayment" : "placed",
    customer: collectCustomerDetails()
  };

  try {
    const orderId = await createOrder({
      ...order,
      // Both flows proceed to payment page for final details confirmation.
      status: paymentMethod === "online" ? "pendingPayment" : "pendingConfirmation",
    });
    window.location.href = `./payment.html?orderId=${encodeURIComponent(orderId)}`;
  } catch {
    showToast("Unable to place order. Check Firestore rules.", "danger");
  }
}

async function boot() {
  if (!(await requireAuthOrRedirect(window.location.pathname))) return;
  products = await getProducts();
  cartLines = await getCartLines();
  if (!cartLines.length) {
    window.location.href = "./cart.html";
    return;
  }

  const totalAmount = renderSummary();

  const pickup = document.getElementById("pp-delivery-pickup");
  const delivery = document.getElementById("pp-delivery-delivery");

  pickup.addEventListener("click", () => {
    deliveryMethod = "pickup";
    setPressed(pickup, true);
    setPressed(delivery, false);
    updateCustomerFieldsVisibility();
    renderPaymentOptions();
    updatePlaceOrderState();
  });
  delivery.addEventListener("click", () => {
    deliveryMethod = "delivery";
    setPressed(delivery, true);
    setPressed(pickup, false);
    updateCustomerFieldsVisibility();
    renderPaymentOptions();
    updatePlaceOrderState();
  });

  ["pp-customer-name", "pp-customer-phone", "pp-customer-address", "pp-pickup-note"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", updatePlaceOrderState);
  });

  updateCustomerFieldsVisibility();
  renderPaymentOptions();
  updatePlaceOrderState();

  document.getElementById("pp-place-order").addEventListener("click", async () => {
    await placeOrder(totalAmount);
  });
}

boot();

