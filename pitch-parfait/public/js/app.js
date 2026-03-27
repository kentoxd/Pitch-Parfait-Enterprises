import { injectChrome } from "./components.js";
import { getCartLines } from "./store.js";
import { isAdminUser, isLoggedIn, loginHref, logout, onAuthChange } from "./auth.js";

function getPrefix() {
  return window.location.pathname.includes("/pages/") ? "../" : "./";
}

function resolveRoutes(prefix) {
  return {
    landing: `${prefix}index.html`,
    home: `${prefix}pages/home.html`,
    cart: `${prefix}pages/cart.html`,
    checkout: `${prefix}pages/checkout.html`,
    payment: `${prefix}pages/payment.html`,
    about: `${prefix}pages/about.html`,
    faq: `${prefix}pages/faq.html`,
    nutrition: `${prefix}pages/nutrition.html`,
    login: `${prefix}pages/login.html`,
    register: `${prefix}pages/register.html`,
    admin: `${prefix}pages/admin.html`
  };
}

function applyRouteLinks(prefix) {
  const routes = resolveRoutes(prefix);
  document.querySelectorAll("[data-route]").forEach((a) => {
    const key = a.getAttribute("data-route");
    if (routes[key]) a.setAttribute("href", routes[key]);
  });
}

async function updateCartCount() {
  try {
    const lines = await getCartLines();
    const count = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    const el = document.getElementById("pp-cart-count");
    if (el) el.textContent = String(count);
  } catch {
    // ignore
  }
}

async function boot() {
  const prefix = getPrefix();
  await injectChrome(prefix);
  applyRouteLinks(prefix);
  const authLink = document.getElementById("pp-auth-link");
  const adminNavItem = document.getElementById("pp-admin-nav");
  const applyAuthState = async () => {
    if (!authLink) return;
    if (isLoggedIn()) {
      authLink.textContent = "Logout";
      authLink.setAttribute("href", "#");
      authLink.onclick = async (e) => {
        e.preventDefault();
        await logout();
        window.location.reload();
      };
    } else {
      authLink.textContent = "Login";
      authLink.setAttribute("href", loginHref(window.location.pathname));
      authLink.onclick = null;
    }
    if (adminNavItem) {
      adminNavItem.classList.add("d-none");
      if (isLoggedIn()) {
        try {
          if (await isAdminUser()) adminNavItem.classList.remove("d-none");
        } catch {
          // ignore role check errors in nav
        }
      }
    }
  }
  await applyAuthState();
  onAuthChange(() => {
    applyAuthState();
  });
  const year = document.getElementById("pp-year");
  if (year) year.textContent = String(new Date().getFullYear());
  await updateCartCount();
}

boot();

