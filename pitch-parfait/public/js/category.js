import { getProducts } from "./store.js";
import { escapeHtml, money } from "./ui.js";

function getCategory() {
  const q = new URLSearchParams(window.location.search);
  return q.get("category") || "";
}

function card(p) {
  return `
    <div class="col-12 col-sm-6 col-lg-3">
      <a href="./product.html?id=${encodeURIComponent(p.id)}" class="card pp-card h-100 text-decoration-none">
        <img class="pp-img-top" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="height:180px;object-fit:cover;" />
        <div class="card-body">
          <div class="fw-semibold text-dark">${escapeHtml(p.name)}</div>
          <div class="pp-muted small mt-1">${money(p.price)}</div>
        </div>
      </a>
    </div>
  `;
}

async function boot() {
  const category = getCategory();
  const title = document.getElementById("pp-category-title");
  const grid = document.getElementById("pp-category-products");
  title.textContent = category || "Category";

  const products = await getProducts();
  const filtered = products.filter((p) => String(p.category).toLowerCase() === category.toLowerCase());
  grid.innerHTML = filtered.length
    ? filtered.map(card).join("")
    : `<div class="col-12"><div class="pp-surface p-4">No products found for this category.</div></div>`;
}

boot();

