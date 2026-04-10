import { isFirebaseConfigured } from "../lib/firebase.js";
import { getProducts } from "./store.js";
import { escapeHtml, showToast } from "./ui.js";

const categories = ["Parfait", "Swirls", "Shakes", "Cakes"];
let allProducts = [];
const categoryImages = {
  Parfait: "../assets/banner/parfaitbanner.png",
  Swirls: "../assets/banner/swirls banner.png",
  Shakes: "../assets/banner/shake banner.png",
  Cakes: "../assets/banner/banner cake.jpg"
};

function renderCategoryGrid() {
  const grid = document.getElementById("pp-category-grid");
  grid.innerHTML = categories
    .map((c, idx) => {
      const count = allProducts.filter((p) => String(p.category).toLowerCase() === c.toLowerCase()).length;
      const colClass = idx === 0 || idx === 3 ? "col-12 col-lg-8" : "col-12 col-lg-4";
      const style = "padding: 30px; "
      
      return `
        <div class="${colClass}" style="${style}">
          <a class="pp-category-card d-block text-decoration-none" href="./category.html?category=${encodeURIComponent(c)}">
            <img src="${escapeHtml(categoryImages[c])}" alt="${escapeHtml(c)}" />
            <div class="pp-category-card__label">${escapeHtml(c.toUpperCase())}</div>
            <div class="pp-category-card__count">${count} item(s)</div>
          </a>
        </div>
      `;
    })
    .join("");
}

async function boot() {
  const warn = document.getElementById("pp-firebase-warning");
  if (!isFirebaseConfigured()) warn.classList.remove("d-none");

  allProducts = await getProducts();
  renderCategoryGrid();

  const newsletter = document.getElementById("pp-newsletter");
  newsletter.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast("Subscribed! (demo)", "success");
    newsletter.reset();
  });
}

boot();

