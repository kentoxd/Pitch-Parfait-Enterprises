import { isFirebaseConfigured } from "../lib/firebase.js";
import { getProducts, getCartLines, setCartLineQty, clearCart } from "./store.js";
import { escapeHtml, money, showToast } from "./ui.js";
import { canAccessRole, getCurrentUserRole, requireAuthOrRedirect } from "./auth.js";

let products = [];

function lineRow(p, qty) {
  const unitPrice = Number(p.unitPrice ?? p.price) || 0;
  const lineTotal = unitPrice * (Number(qty) || 0);
  const sizeLabel = p.size ? `Size: ${escapeHtml(String(p.size))}` : "";
  const toppings = Array.isArray(p.toppings) && p.toppings.length ? `Toppings: ${escapeHtml(p.toppings.join(", "))}` : "";
  return `
    <div class="pp-surface p-3 p-lg-4" data-line="${escapeHtml(p.lineId)}">
      <div class="row g-3 align-items-center">
        <div class="col-4 col-md-3 col-lg-2">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;height:86px;object-fit:cover;border-radius:14px;" />
        </div>
        <div class="col-8 col-md-5 col-lg-6">
          <div class="fw-semibold">${escapeHtml(p.name)}</div>
          <div class="pp-muted small">${escapeHtml(p.category)}</div>
          ${sizeLabel ? `<div class="pp-muted small">${sizeLabel}</div>` : ""}
          ${toppings ? `<div class="pp-muted small">${toppings}</div>` : ""}
          <div class="pp-muted small mt-1">${escapeHtml(p.description || "")}</div>
        </div>
        <div class="col-12 col-md-4 col-lg-4">
          <div class="d-flex align-items-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-2">
              <button class="btn pp-btn-secondary" data-dec="${escapeHtml(p.lineId)}" type="button">−</button>
              <div class="fw-semibold" style="min-width:32px;text-align:center;">${qty}</div>
              <button class="btn pp-btn-secondary" data-inc="${escapeHtml(p.lineId)}" type="button">+</button>
            </div>
            <div class="text-end">
              <div class="fw-semibold">${money(lineTotal)}</div>
              <button class="btn btn-link p-0 small pp-muted" data-remove="${escapeHtml(p.lineId)}" type="button">Remove</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function computeSubtotal(cartLines) {
  return cartLines.reduce((sum, l) => {
    const p = products.find((x) => x.id === l.productId);
    if (!p) return sum;
    const unitPrice = Number(l.unitPrice ?? p.price) || 0;
    return sum + unitPrice * (Number(l.quantity) || 0);
  }, 0);
}

async function render() {
  const host = document.getElementById("pp-cart-lines");
  const empty = document.getElementById("pp-empty");
  const checkout = document.getElementById("pp-checkout");
  let cartLines = [];
  try {
    cartLines = await getCartLines();
  } catch (error) {
    console.error("Load cart failed", error);
    showToast("Unable to load cart right now.", "danger");
  }
  if (!cartLines.length) {
    host.innerHTML = "";
    empty.classList.remove("d-none");
    checkout.classList.add("disabled");
  } else {
    empty.classList.add("d-none");
    checkout.classList.remove("disabled");
    host.innerHTML = cartLines
      .map((l) => {
        const p = products.find((x) => x.id === l.productId);
        if (!p) return "";
        return lineRow({ ...p, lineId: l.id, unitPrice: l.unitPrice, size: l.size, toppings: l.toppings }, l.quantity);
      })
      .join("");
  }

  const subtotal = computeSubtotal(cartLines);
  document.getElementById("pp-subtotal").textContent = money(subtotal);
  document.getElementById("pp-total").textContent = money(subtotal);

  host.querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-inc");
      const line = cartLines.find((l) => l.id === id);
      await setCartLineQty(id, (Number(line?.quantity) || 0) + 1);
      await render();
    })
  );
  host.querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-dec");
      const line = cartLines.find((l) => l.id === id);
      await setCartLineQty(id, (Number(line?.quantity) || 0) - 1);
      await render();
    })
  );
  host.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-remove");
      await setCartLineQty(id, 0);
      showToast("Removed from cart.", "success");
      await render();
    })
  );
}

async function boot() {
  if (!(await requireAuthOrRedirect(window.location.pathname))) return;
  const role = await getCurrentUserRole();
  if (!canAccessRole(role, "customer")) {
    showToast("Only customers can use cart features.", "warning");
    window.location.href = "./home.html";
    return;
  }
  const warn = document.getElementById("pp-cart-warning");
  if (!isFirebaseConfigured()) warn.classList.remove("d-none");

  products = await getProducts();

  document.getElementById("pp-clear").addEventListener("click", async () => {
    await clearCart();
    showToast("Cart cleared.", "success");
    await render();
  });

  await render();
}

boot();

