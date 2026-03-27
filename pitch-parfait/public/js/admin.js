import { deleteProduct, getProducts, listOrders, upsertProduct } from "./store.js";
import { currentUser, isAdminUser, requireAuthOrRedirect } from "./auth.js";
import { money, showToast, escapeHtml } from "./ui.js";

let products = [];

function resetForm() {
  document.getElementById("pp-product-id").value = "";
  document.getElementById("pp-name").value = "";
  document.getElementById("pp-category").value = "Parfait";
  document.getElementById("pp-price").value = "";
  document.getElementById("pp-image").value = "";
  document.getElementById("pp-description").value = "";
}

function renderProductsTable() {
  const body = document.getElementById("pp-products-body");
  body.innerHTML = products
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${money(p.price)}</td>
        <td class="text-end">
          <button class="btn btn-sm pp-btn-secondary me-1" data-edit="${escapeHtml(p.id)}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-del="${escapeHtml(p.id)}">Delete</button>
        </td>
      </tr>
    `
    )
    .join("");

  body.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const p = products.find((x) => x.id === id);
      if (!p) return;
      document.getElementById("pp-product-id").value = p.id;
      document.getElementById("pp-name").value = p.name || "";
      document.getElementById("pp-category").value = p.category || "Parfait";
      document.getElementById("pp-price").value = p.price ?? "";
      document.getElementById("pp-image").value = p.image || "";
      document.getElementById("pp-description").value = p.description || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  body.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Delete this product?")) return;
      try {
        await deleteProduct(id);
        showToast("Product deleted.", "success");
        await loadProducts();
      } catch (e) {
        showToast(e?.message || "Failed to delete product.", "danger");
      }
    });
  });
}

async function loadProducts() {
  products = await getProducts();
  renderProductsTable();
}

async function loadOrders() {
  const rows = await listOrders(100);
  const body = document.getElementById("pp-orders-body");
  body.innerHTML = rows
    .map(
      (o) => `
      <tr>
        <td><code>${escapeHtml(o.id)}</code></td>
        <td>${escapeHtml(o.userEmail || o.userId || "-")}</td>
        <td>${money(o.totalAmount || 0)}</td>
        <td>${escapeHtml(o.status || "placed")}</td>
      </tr>
    `
    )
    .join("");
}

async function boot() {
  if (!(await requireAuthOrRedirect(window.location.pathname))) return;
  const denied = document.getElementById("pp-admin-denied");
  const content = document.getElementById("pp-admin-content");
  const user = currentUser();
  if (!user || !(await isAdminUser())) {
    denied.classList.remove("d-none");
    return;
  }
  content.classList.remove("d-none");

  const form = document.getElementById("pp-product-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      id: document.getElementById("pp-product-id").value.trim() || undefined,
      name: document.getElementById("pp-name").value.trim(),
      category: document.getElementById("pp-category").value.trim(),
      price: Number(document.getElementById("pp-price").value || 0),
      image: document.getElementById("pp-image").value.trim(),
      description: document.getElementById("pp-description").value.trim(),
    };
    try {
      await upsertProduct(payload);
      showToast("Product saved.", "success");
      resetForm();
      await loadProducts();
    } catch (err) {
      showToast(err?.message || "Failed to save product.", "danger");
    }
  });
  document.getElementById("pp-reset").addEventListener("click", resetForm);

  await loadProducts();
  await loadOrders();
}

boot();

