export function normalizeOrderMethod(value) {
  const method = String(value || "").toLowerCase();
  if (method === "pickup" || method === "delivery") return method;
  return "";
}

export function getOrderMethod(order) {
  return normalizeOrderMethod(order?.orderMethod || order?.deliveryMethod || "");
}

export function orderMethodLabel(value) {
  const method = normalizeOrderMethod(value);
  if (method === "pickup") return "Pickup";
  if (method === "delivery") return "Delivery";
  return "-";
}

export function normalizeOrderStatus(rawStatus) {
  const status = String(rawStatus || "").toLowerCase().replaceAll(/\s+/g, "");
  if (status.includes("cancel")) return "cancelled";
  if (status === "finished" || status === "completed") return "finished";
  if (status === "readyforpickup") return "readyForPickup";
  if (status === "delivered") return "delivered";
  if (status === "shipped" || status === "outfordelivery") return "shipped";
  if (status === "processing" || status === "paid" || status === "preparing") return "processing";
  return "pending";
}

export function orderStatusMeta(rawStatus) {
  const normalized = normalizeOrderStatus(rawStatus);
  const byStatus = {
    pending: { value: "pending", label: "Pending", className: "pp-status--pending" },
    processing: { value: "processing", label: "Processing", className: "pp-status--processing" },
    readyForPickup: { value: "readyForPickup", label: "Ready for Pickup", className: "pp-status--processing" },
    shipped: { value: "shipped", label: "Shipped", className: "pp-status--shipped" },
    delivered: { value: "delivered", label: "Delivered", className: "pp-status--delivered" },
    finished: { value: "finished", label: "Finished", className: "pp-status--finished" },
    cancelled: { value: "cancelled", label: "Cancelled", className: "pp-status--cancelled" },
  };
  return byStatus[normalized];
}

export function statusBadgeHtml(rawStatus) {
  const meta = orderStatusMeta(rawStatus);
  return `<span class="pp-status-pill ${meta.className}">${meta.label}</span>`;
}

export function statusOptionsForMethod(methodInput) {
  const method = normalizeOrderMethod(methodInput);
  if (method === "pickup") {
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
