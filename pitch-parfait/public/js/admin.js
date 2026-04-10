import { deleteProduct, getProducts, listOrders, updateOrder, upsertProduct } from "./store.js";
import { currentUser, isAdminUser, requireAuthOrRedirect } from "./auth.js";
import { money, showToast, escapeHtml } from "./ui.js";

let products = [];
let orders = [];
let selectedOrderId = null;
let selectedImageBase64 = "";
let productFilterCategory = "all";
let productPage = 1;
const PRODUCTS_PER_PAGE = 10;

function getOrderMethod(order) {
  return String(order?.orderMethod || order?.deliveryMethod || "").toLowerCase();
}

function normalizeOrderStatus(rawStatus) {
  const status = String(rawStatus || "").toLowerCase().replaceAll(/\s+/g, "");
  if (status.includes("cancel")) return "cancelled";
  if (status === "finished" || status === "completed") return "finished";
  if (status === "readyforpickup") return "readyForPickup";
  if (status === "delivered") return "delivered";
  if (status === "shipped" || status === "outfordelivery") return "shipped";
  if (status === "processing" || status === "paid" || status === "preparing" || status === "readyforpickup") {
    return "processing";
  }
  return "pending";
}

function statusMeta(rawStatus) {
  const normalized = normalizeOrderStatus(rawStatus);
  const byStatus = {
    pending: { label: "Pending", className: "pp-status--pending" },
    processing: { label: "Processing", className: "pp-status--processing" },
    readyForPickup: { label: "Ready for Pickup", className: "pp-status--processing" },
    shipped: { label: "Shipped", className: "pp-status--shipped" },
    delivered: { label: "Delivered", className: "pp-status--delivered" },
    finished: { label: "Finished", className: "pp-status--finished" },
    cancelled: { label: "Cancelled", className: "pp-status--cancelled" },
  };
  return byStatus[normalized];
}

function statusBadge(rawStatus) {
  const meta = statusMeta(rawStatus);
  return `<span class="pp-status-pill ${meta.className}">${meta.label}</span>`;
}

function statusOptionsForMethod(orderMethod) {
  if (orderMethod === "pickup") {
    return [
      { value: "pending", label: "Pending" },
      { value: "processing", label: "Processing" },
      { value: "readyForPickup", label: "Ready for Pickup" },
      { value: "finished", label: "Finished" },
    ];
  }
  return [
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "finished", label: "Finished" },
  ];
}

function renderStatusSelect(order) {
  const select = document.getElementById("pp-detail-status-select");
  const orderMethod = getOrderMethod(order);
  const options = statusOptionsForMethod(orderMethod);
  select.innerHTML = options.map((opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join("");
  const normalized = normalizeOrderStatus(order.status);
  const allowed = new Set(options.map((opt) => opt.value));
  select.value = allowed.has(normalized) ? normalized : "pending";
}

function setImagePreview(src) {
  const preview = document.getElementById("pp-image-preview");
  if (!preview) return;
  if (src) {
    preview.classList.remove("d-none");
    preview.src = src;
    return;
  }
  preview.classList.add("d-none");
  preview.removeAttribute("src");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function resetForm() {
  document.getElementById("pp-product-id").value = "";
  document.getElementById("pp-name").value = "";
  document.getElementById("pp-category").value = "Parfait";
  document.getElementById("pp-price").value = "";
  document.getElementById("pp-image-file").value = "";
  document.getElementById("pp-description").value = "";
  selectedImageBase64 = "";
  setImagePreview("");
}

function renderProductsTable() {
  const body = document.getElementById("pp-products-body");
  const filtered = products.filter((p) => {
    if (productFilterCategory === "all") return true;
    return String(p.category || "").toLowerCase() === productFilterCategory.toLowerCase();
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  if (productPage > totalPages) productPage = totalPages;
  const start = (productPage - 1) * PRODUCTS_PER_PAGE;
  const pageItems = filtered.slice(start, start + PRODUCTS_PER_PAGE);

  body.innerHTML = pageItems
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

  if (!pageItems.length) {
    body.innerHTML = `<tr><td colspan="4" class="pp-muted">No products found for this category.</td></tr>`;
  }

  renderProductPagination(totalPages);

  body.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const p = products.find((x) => x.id === id);
      if (!p) return;
      document.getElementById("pp-product-id").value = p.id;
      document.getElementById("pp-name").value = p.name || "";
      document.getElementById("pp-category").value = p.category || "Parfait";
      document.getElementById("pp-price").value = p.price ?? "";
      document.getElementById("pp-image-file").value = "";
      document.getElementById("pp-description").value = p.description || "";
      selectedImageBase64 = p.image || "";
      setImagePreview(selectedImageBase64);
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

function renderProductPagination(totalPages) {
  const host = document.getElementById("pp-products-pagination");
  if (!host) return;
  if (totalPages <= 1) {
    host.innerHTML = "";
    return;
  }
  const pageButtons = Array.from({ length: totalPages }, (_, idx) => {
    const page = idx + 1;
    const active = page === productPage ? "active" : "";
    return `<li class="page-item ${active}"><button class="page-link" type="button" data-page="${page}">${page}</button></li>`;
  }).join("");
  host.innerHTML = `
    <nav aria-label="Products pagination">
      <ul class="pagination pagination-sm mb-0">
        <li class="page-item ${productPage <= 1 ? "disabled" : ""}">
          <button class="page-link" type="button" data-page-prev>&laquo;</button>
        </li>
        ${pageButtons}
        <li class="page-item ${productPage >= totalPages ? "disabled" : ""}">
          <button class="page-link" type="button" data-page-next>&raquo;</button>
        </li>
      </ul>
    </nav>
  `;
  host.querySelector("[data-page-prev]")?.addEventListener("click", () => {
    if (productPage <= 1) return;
    productPage -= 1;
    renderProductsTable();
  });
  host.querySelector("[data-page-next]")?.addEventListener("click", () => {
    if (productPage >= totalPages) return;
    productPage += 1;
    renderProductsTable();
  });
  host.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      productPage = Number(btn.getAttribute("data-page")) || 1;
      renderProductsTable();
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
        <td>${statusBadge(o.status)}</td>
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
  document.getElementById("pp-detail-status").innerHTML = statusBadge(order.status);
  const orderMethod = getOrderMethod(order);
  document.getElementById("pp-detail-order-method").textContent = orderMethod ? `${orderMethod.charAt(0).toUpperCase()}${orderMethod.slice(1)}` : "-";
  document.getElementById("pp-detail-payment").textContent = order.paymentMethod || "-";
  document.getElementById("pp-detail-payer").textContent = order.payerName || "-";
  document.getElementById("pp-detail-reference").textContent = order.paymentReference || "-";
  document.getElementById("pp-detail-total").textContent = money(order.totalAmount || 0);
  renderStatusSelect(order);

  const itemsBody = document.getElementById("pp-detail-items");
  const items = Array.isArray(order.items) ? order.items : [];
  itemsBody.innerHTML = items.length
    ? items
        .map((item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          const lineTotal = qty * price;
          const toppings = Array.isArray(item.toppings) ? item.toppings : [];
          const toppingsLine = toppings.length
            ? `<div class="pp-muted small">Extra toppings: ${escapeHtml(toppings.join(", "))}</div>`
            : "";
          return `
            <tr>
              <td>
                <div>${escapeHtml(item.name || "-")}</div>
                ${toppingsLine}
              </td>
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
  const imageFileInput = document.getElementById("pp-image-file");
  imageFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      selectedImageBase64 = await readFileAsDataUrl(file);
      setImagePreview(selectedImageBase64);
    } catch (error) {
      showToast(error?.message || "Could not preview selected image.", "danger");
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedImageBase64) {
      showToast("Please upload a product image.", "danger");
      return;
    }
    const payload = {
      id: document.getElementById("pp-product-id").value.trim() || undefined,
      name: document.getElementById("pp-name").value.trim(),
      category: document.getElementById("pp-category").value.trim(),
      price: Number(document.getElementById("pp-price").value || 0),
      image: selectedImageBase64,
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
  const categoryFilter = document.getElementById("pp-products-category-filter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      productFilterCategory = categoryFilter.value || "all";
      productPage = 1;
      renderProductsTable();
    });
  }
  document.getElementById("pp-detail-status-save").addEventListener("click", async () => {
    await saveSelectedOrderStatus();
  });

  await loadProducts();
  await loadOrders();
}

boot();

