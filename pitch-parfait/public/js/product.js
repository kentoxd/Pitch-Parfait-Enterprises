import { addOrIncrementCartLine, getProducts } from "./store.js";
import { money, showToast, escapeHtml } from "./ui.js";
import { isFirebaseConfigured } from "../lib/firebase.js";
import { canAccessRole, getCurrentUserRole, requireAuthOrRedirect } from "./auth.js";

const sizeMap = [
  { key: "small", label: "Small", add: 0 },
  { key: "medium", label: "Medium", add: 20 },
  { key: "large", label: "Large", add: 40 }
];
const toppings = [
  { key: "white-choco", label: "White Chocolate Syrup", add: 10 },
  { key: "dark-choco", label: "Dark Chocolate Syrup", add: 10 },
  { key: "nuts", label: "Nuts", add: 12 },
  { key: "oreo", label: "Oreo Crumbs", add: 12 },
  { key: "biscoff", label: "Biscoff Cookie", add: 15 },
  { key: "mango", label: "Mango", add: 15 }
];

function getProductId() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function setupOptions(product) {
  let selectedSize = "small";
  const selectedToppings = new Set();
  let currentTotal = Number(product.price) || 0;

  const sizeHost = document.getElementById("pp-size-options");
  sizeHost.innerHTML = sizeMap
    .map((s) => `<div class="col-4"><button class="pp-option w-100" data-size="${s.key}" aria-pressed="${s.key === selectedSize ? "true" : "false"}">${s.label}</button></div>`)
    .join("");

  const topHost = document.getElementById("pp-toppings");
  topHost.innerHTML = toppings
    .map((t) => `<div class="col-12 col-md-6"><button class="pp-option w-100 text-start" data-top="${t.key}" aria-pressed="false">${escapeHtml(t.label)} <span class="float-end">+${money(t.add)}</span></button></div>`)
    .join("");

  const calcTotal = () => {
    const base = Number(product.price) || 0;
    const sizeAdd = sizeMap.find((s) => s.key === selectedSize)?.add || 0;
    const topAdd = [...selectedToppings].reduce((sum, k) => sum + (toppings.find((t) => t.key === k)?.add || 0), 0);
    const total = base + sizeAdd + topAdd;
    currentTotal = total;
    document.getElementById("pp-total-price").textContent = money(total);
    return total;
  };

  sizeHost.querySelectorAll("[data-size]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSize = btn.getAttribute("data-size");
      sizeHost.querySelectorAll("[data-size]").forEach((el) => el.setAttribute("aria-pressed", el === btn ? "true" : "false"));
      calcTotal();
    });
  });

  topHost.querySelectorAll("[data-top]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-top");
      if (selectedToppings.has(key)) selectedToppings.delete(key);
      else selectedToppings.add(key);
      btn.setAttribute("aria-pressed", selectedToppings.has(key) ? "true" : "false");
      calcTotal();
    });
  });

  calcTotal();
  return () => ({
    unitPrice: Number(currentTotal) || 0,
    selectedSize,
    selectedToppings: [...selectedToppings],
  });
}

async function boot() {
  const id = getProductId();
  const products = await getProducts();
  const product = products.find((p) => p.id === id);
  if (!product) {
    window.location.href = "./home.html";
    return;
  }

  document.getElementById("pp-product-category").textContent = product.category;
  document.getElementById("pp-back-category").href = `./category.html?category=${encodeURIComponent(product.category)}`;
  document.getElementById("pp-product-image").src = product.image;
  document.getElementById("pp-product-name-left").textContent = product.name;
  document.getElementById("pp-product-name").textContent = product.name;
  document.getElementById("pp-product-base-price").textContent = money(product.price);
  document.getElementById("pp-product-desc").textContent = product.description || "";
  const addButton = document.getElementById("pp-add-cart");
  const stockQty = Number(product.stockQty ?? 0);
  if (stockQty <= 0) {
    addButton.disabled = true;
    addButton.textContent = "Out of Stock";
  }

  const getSelection = setupOptions(product);

  addButton.addEventListener("click", async () => {
    if (!isFirebaseConfigured()) {
      showToast("Add Firebase config first to use cart.", "warning");
      return;
    }
    if (!(await requireAuthOrRedirect(window.location.pathname + window.location.search))) return;
    const role = await getCurrentUserRole();
    if (!canAccessRole(role, "customer")) {
      showToast("Only customers can add to cart.", "warning");
      return;
    }
    try {
      const selection = getSelection();
      await addOrIncrementCartLine(product.id, {
        unitPrice: selection.unitPrice,
        size: selection.selectedSize || "small",
        toppings: selection.selectedToppings || [],
      });
      showToast("Added to cart!", "success");
    } catch (error) {
      console.error("Add to cart failed", error);
      showToast("Unable to add to cart. Please try again.", "danger");
    }
  });
}

boot();

