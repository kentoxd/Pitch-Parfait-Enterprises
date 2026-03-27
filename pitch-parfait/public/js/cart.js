import { isFirebaseConfigured } from "../lib/firebase.js";
import { getProducts, getCartLines, setCartQty, clearCart } from "./store.js";
import { escapeHtml, money, showToast } from "./ui.js";
import { requireAuthOrRedirect } from "./auth.js";

let products = [];

function lineRow(p, qty) {
  const lineTotal = (Number(p.price) || 0) * (Number(qty) || 0);
  return `
    <div class="pp-surface p-3 p-lg-4" data-line="${escapeHtml(p.id)}">
      <div class="row g-3 align-items-center">
        <div class="col-4 col-md-3 col-lg-2">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;height:86px;object-fit:cover;border-radius:14px;" />
        </div>
        <div class="col-8 col-md-5 col-lg-6">
          <div class="fw-semibold">${escapeHtml(p.name)}</div>
          <div class="pp-muted small">${escapeHtml(p.category)}</div>
          <div class="pp-muted small mt-1">${escapeHtml(p.description || "")}</div>
        </div>
        <div class="col-12 col-md-4 col-lg-4">
          <div class="d-flex align-items-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-2">
              <button class="btn pp-btn-secondary" data-dec="${escapeHtml(p.id)}" type="button">−</button>
              <div class="fw-semibold" style="min-width:32px;text-align:center;">${qty}</div>
              <button class="btn pp-btn-secondary" data-inc="${escapeHtml(p.id)}" type="button">+</button>
            </div>
            <div class="text-end">
              <div class="fw-semibold">${money(lineTotal)}</div>
              <button class="btn btn-link p-0 small pp-muted" data-remove="${escapeHtml(p.id)}" type="button">Remove</button>
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
    return sum + (Number(p.price) || 0) * (Number(l.quantity) || 0);
  }, 0);
}

async function render() {
  const host = document.getElementById("pp-cart-lines");
  const empty = document.getElementById("pp-empty");
  const checkout = document.getElementById("pp-checkout");

  const cartLines = await getCartLines();
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
        return lineRow(p, l.quantity);
      })
      .join("");
  }

  const subtotal = computeSubtotal(cartLines);
  document.getElementById("pp-subtotal").textContent = money(subtotal);
  document.getElementById("pp-total").textContent = money(subtotal);

  host.querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-inc");
      const line = cartLines.find((l) => l.productId === id);
      await setCartQty(id, (Number(line?.quantity) || 0) + 1);
      await render();
    })
  );
  host.querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-dec");
      const line = cartLines.find((l) => l.productId === id);
      await setCartQty(id, (Number(line?.quantity) || 0) - 1);
      await render();
    })
  );
  host.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-remove");
      await setCartQty(id, 0);
      showToast("Removed from cart.", "success");
      await render();
    })
  );
}

async function boot() {
  if (!(await requireAuthOrRedirect(window.location.pathname))) return;
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

