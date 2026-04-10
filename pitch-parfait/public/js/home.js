import { isFirebaseConfigured } from "../lib/firebase.js";
import { getProducts } from "./store.js";
import { escapeHtml, showToast } from "./ui.js";

const categories = ["Parfait", "Swirls", "Shakes", "Cakes"];
let allProducts = [];
const categoryImages = {
  Parfait: "https://cdn.discordapp.com/attachments/1488093221014994986/1488121452484890666/parfait_banner.png?ex=69d9785a&is=69d826da&hm=1c396c345d35560efbe3d9b93d0b908ae6386c5702ecd1a241b3deac24866cbf&",
  Swirls: "https://cdn.discordapp.com/attachments/1488093221014994986/1488121500648345732/swirls_banner.png?ex=69d97865&is=69d826e5&hm=3a60aba32154c358024c3052dfe9805e0c2dde8c8295bb6e6df558a1680e3c7f&",
  Shakes: "https://cdn.discordapp.com/attachments/1488093221014994986/1488121481341960292/shake_banner.png?ex=69d97861&is=69d826e1&hm=2d67ed3d7223ddeafc3fe1b54f3f23cc84a7bc96938f5bfd2875ef0e06d2aade&",
  Cakes: "https://cdn.discordapp.com/attachments/1488093221014994986/1488120795849949194/banner_cake.jpg?ex=69d977bd&is=69d8263d&hm=675ddb676c898270b073c54e3b5edc7bf8ac6ef9b350025afeaa6eced324e301&"
};

function renderCategoryGrid() {
  const grid = document.getElementById("pp-category-grid");
  grid.innerHTML = categories
    .map((c, idx) => {
      const count = allProducts.filter((p) => String(p.category).toLowerCase() === c.toLowerCase()).length;
      const colClass = idx === 0 || idx === 3 ? "col-12 col-lg-8" : "col-12 col-lg-4";
      const style = "padding: 30px;"
      const imgClass = "h-100"
      return `
        <div class="${colClass}" style="${style}">
          <a class="pp-category-card d-block text-decoration-none" href="./category.html?category=${encodeURIComponent(c)}">
            <img src="${escapeHtml(categoryImages[c])}" alt="${escapeHtml(c)}" class="${imgClass}"/>
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

