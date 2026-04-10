import { currentUser, getCurrentUserProfile, requireAuthOrRedirect } from "./auth.js";
import { listOrdersForCurrentUser } from "./store.js";
import { escapeHtml, money } from "./ui.js";

function normalizeOrderStatus(rawStatus) {
  const status = String(rawStatus || "").toLowerCase().replaceAll(/\s+/g, "");
  if (status.includes("cancel")) return "cancelled";
  if (status === "finished" || status === "completed") return "finished";
  if (status === "readyforpickup") return "readyForPickup";
  if (status === "delivered") return "delivered";
  if (status === "shipped" || status === "outfordelivery") return "shipped";
  if (status === "processing" || status === "paid" || status === "preparing") {
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

function formatDate(value) {
  if (!value) return "-";
  try {
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function renderOrders(orders) {
  const body = document.getElementById("pp-account-orders-body");
  const empty = document.getElementById("pp-account-orders-empty");
  if (!orders.length) {
    body.innerHTML = "";
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");
  body.innerHTML = orders
    .map((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const itemCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const details = items.length
        ? items
            .map((it) => {
              const qty = Number(it.quantity) || 0;
              const lineTotal = (Number(it.price) || 0) * qty;
              const toppings = Array.isArray(it.toppings) && it.toppings.length
                ? ` <span class="pp-muted">Extra toppings: ${escapeHtml(it.toppings.join(", "))}</span>`
                : "";
              return `<li>${escapeHtml(it.name || "-")} x${qty} - ${money(lineTotal)}${toppings}</li>`;
            })
            .join("")
        : "<li>No items found.</li>";
      const orderMethod = String(o.orderMethod || o.deliveryMethod || "-");
      return `
        <tr>
          <td><code>${escapeHtml(o.id || "-")}</code></td>
          <td>${escapeHtml(formatDate(o.createdAt))}</td>
          <td>
            <details>
              <summary class="small">${itemCount} item(s) - View details</summary>
              <div class="small mt-2">Order Method: <span class="fw-semibold text-capitalize">${escapeHtml(orderMethod)}</span></div>
              <div class="small">Payer Name: <span class="fw-semibold">${escapeHtml(o.payerName || "-")}</span></div>
              <ul class="mb-0 mt-2 small">${details}</ul>
            </details>
          </td>
          <td>${money(o.totalAmount || 0)}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>
      `;
    })
    .join("");
}

async function boot() {
  if (!(await requireAuthOrRedirect(window.location.pathname))) return;
  const denied = document.getElementById("pp-account-denied");
  const content = document.getElementById("pp-account-content");
  if (!currentUser()) {
    denied.classList.remove("d-none");
    return;
  }
  content.classList.remove("d-none");

  const profile = await getCurrentUserProfile();
  document.getElementById("pp-account-name").textContent = profile?.displayName || profile?.name || "-";
  document.getElementById("pp-account-email").textContent = profile?.email || "-";
  document.getElementById("pp-account-role").textContent = profile?.role || "customer";

  const orders = await listOrdersForCurrentUser(100);
  renderOrders(orders);
}

boot();
