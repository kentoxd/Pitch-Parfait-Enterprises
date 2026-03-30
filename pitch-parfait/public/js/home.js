import { isFirebaseConfigured } from "../lib/firebase.js";
import { getProducts } from "./store.js";
import { escapeHtml, showToast } from "./ui.js";

const categories = ["Parfait", "Swirls", "Shakes", "Cakes"];
let allProducts = [];
const categoryImages = {
  Parfait: "https://cdn.discordapp.com/attachments/1488093221014994986/1488093274630787092/parfaitbanner.png?ex=69cb865c&is=69ca34dc&hm=3862f6b74006317c66d304eec227b44e7d9c49afe4ce1c2af6cad28588f329fd&",
  Swirls: "https://placehold.co/900x700/png?text=Swirls",
  Shakes: "https://placehold.co/900x700/png?text=Shakes",
  Cakes: "https://placehold.co/900x700/png?text=Cakes"
};

function renderCategoryGrid() {
  const grid = document.getElementById("pp-category-grid");
  grid.innerHTML = categories
    .map((c, idx) => {
      const count = allProducts.filter((p) => String(p.category).toLowerCase() === c.toLowerCase()).length;
      const colClass = idx === 0 || idx === 3 ? "col-12 col-lg-8" : "col-12 col-lg-4";
      return `
        <div class="${colClass}">
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

