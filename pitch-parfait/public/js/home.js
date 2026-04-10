import { isFirebaseConfigured } from "../lib/firebase.js";
import { getProducts } from "./store.js";
import { escapeHtml, showToast } from "./ui.js";

const categories = ["Parfait", "Swirls", "Shakes", "Cakes"];
let allProducts = [];
const categoryImages = {
  Parfait: "https://cdn.discordapp.com/attachments/1488093221014994986/1488093274630787092/parfaitbanner.png?ex=69cb865c&is=69ca34dc&hm=3862f6b74006317c66d304eec227b44e7d9c49afe4ce1c2af6cad28588f329fd&",
  Swirls: "https://cdn.discordapp.com/attachments/1488093221014994986/1488121500648345732/swirls_banner.png?ex=69cba0a5&is=69ca4f25&hm=ef45026229f21d2eea34882b625f975f8a3f4fa2027063bea67296d7c08db25d&",
  Shakes: "https://cdn.discordapp.com/attachments/1488093221014994986/1488121481341960292/shake_banner.png?ex=69cba0a1&is=69ca4f21&hm=7bbe664ad55d3be066f60c5054e9d6511e4c7de21f72b162aa7c42376a447250&",
  Cakes: "https://cdn.discordapp.com/attachments/1488093221014994986/1488120795849949194/banner_cake.jpg?ex=69cb9ffd&is=69ca4e7d&hm=77a85c606aa120a194b37252e2d95cf03a8f1a14b499ddaf9856f13c384252d8&"
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

