import { deleteProduct, getProducts, listOrders, updateOrder, upsertProduct } from "./store.js";
import { currentUser, isAdminUser, requireAuthOrRedirect } from "./auth.js";
import { money, showToast, escapeHtml } from "./ui.js";

let products = [];
let orders = [];
let selectedOrderId = null;

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
  orders = await listOrders(100);
  const body = document.getElementById("pp-orders-body");
  body.innerHTML = orders
    .map(
      (o) => `
      <tr>
        <td><code>${escapeHtml(o.id)}</code></td>
        <td>${escapeHtml(o.userEmail || o.userId || "-")}</td>
        <td>${escapeHtml(formatDate(o.createdAt))}</td>
        <td>${money(o.totalAmount || 0)}</td>
        <td>${escapeHtml(o.status || "placed")}</td>
        <td class="text-end">
          <button class="btn btn-sm pp-btn-secondary" data-view-order="${escapeHtml(o.id)}">View Details</button>
        </td>
      </tr>
    `
    )
    .join("");

  body.querySelectorAll("[data-view-order]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-view-order");
      const order = orders.find((x) => x.id === id);
      if (order) renderOrderDetails(order);
    });
  });

  if (orders.length) renderOrderDetails(orders[0]);
}

function formatDate(value) {
  if (!value) return "-";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString();
    }
    if (value.seconds) {
      return new Date(value.seconds * 1000).toLocaleString();
    }
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function renderOrderDetails(order) {
  selectedOrderId = order.id || null;
  document.getElementById("pp-order-empty").classList.add("d-none");
  document.getElementById("pp-order-details").classList.remove("d-none");

  document.getElementById("pp-detail-id").textContent = order.id || "-";
  document.getElementById("pp-detail-created").textContent = formatDate(order.createdAt);
  document.getElementById("pp-detail-user").textContent = order.userEmail || order.userId || "-";
  document.getElementById("pp-detail-status").textContent = order.status || "placed";
  document.getElementById("pp-detail-delivery").textContent = order.deliveryMethod || "-";
  document.getElementById("pp-detail-payment").textContent = order.paymentMethod || "-";
  document.getElementById("pp-detail-payer").textContent = order.payerName || "-";
  document.getElementById("pp-detail-reference").textContent = order.paymentReference || "-";
  document.getElementById("pp-detail-total").textContent = money(order.totalAmount || 0);
  document.getElementById("pp-detail-status-select").value = order.status || "placed";

  const itemsBody = document.getElementById("pp-detail-items");
  const items = Array.isArray(order.items) ? order.items : [];
  itemsBody.innerHTML = items.length
    ? items
        .map((item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          const lineTotal = qty * price;
          return `
            <tr>
              <td>${escapeHtml(item.name || "-")}</td>
              <td>${qty}</td>
              <td>${money(price)}</td>
              <td>${money(lineTotal)}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="4" class="pp-muted">No order items.</td></tr>`;
}

async function saveSelectedOrderStatus() {
  if (!selectedOrderId) return;
  const nextStatus = document.getElementById("pp-detail-status-select").value;
  try {
    await updateOrder(selectedOrderId, {
      status: nextStatus,
      statusUpdatedAt: new Date().toISOString(),
    });
    showToast("Order status updated.", "success");
    await loadOrders();
    const selected = orders.find((o) => o.id === selectedOrderId);
    if (selected) renderOrderDetails(selected);
  } catch (error) {
    showToast(error?.message || "Failed to update order status.", "danger");
  }
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
  document.getElementById("pp-detail-status-save").addEventListener("click", async () => {
    await saveSelectedOrderStatus();
  });

  await loadProducts();
  await loadOrders();
}

boot();

