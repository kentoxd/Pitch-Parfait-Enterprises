import { injectChrome } from "./components.js";
import { getCartLines } from "./store.js";
import { getCurrentUserRole, isLoggedIn, loginHref, logout, onAuthChange, waitForAuthReady, canAccessRole } from "./auth.js";

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
    account: `${prefix}pages/account.html`,
    login: `${prefix}pages/login.html`,
    register: `${prefix}pages/register.html`,
    admin: `${prefix}pages/admin.html`
  };
}

function ensureLogoutModal() {
  if (document.getElementById("pp-logout-modal")) return;
  const host = document.createElement("div");
  host.innerHTML = `
    <div class="modal fade" id="pp-logout-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Confirm Logout</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">Are you sure you want to log out?</div>
          <div class="modal-footer">
            <button type="button" class="btn pp-btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn pp-btn-primary" id="pp-confirm-logout">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(host.firstElementChild);
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
    await waitForAuthReady();
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
  const logoImg = document.getElementById("pp-logo-img");
  if (logoImg) logoImg.src = `${prefix}assets/banner/logo.png`;
  const authLink = document.getElementById("pp-auth-link");
  const adminNavItem = document.getElementById("pp-admin-nav");
  const accountNavItem = document.getElementById("pp-account-nav");
  ensureLogoutModal();
  const logoutModalEl = document.getElementById("pp-logout-modal");
  const logoutModal = window.bootstrap ? new window.bootstrap.Modal(logoutModalEl) : null;
  const confirmLogoutBtn = document.getElementById("pp-confirm-logout");
  if (confirmLogoutBtn) {
    confirmLogoutBtn.onclick = async () => {
      await logout();
      if (logoutModal) logoutModal.hide();
      window.location.reload();
    };
  }
  const applyAuthState = async () => {
    if (!authLink) return;
    let userHasDashboardAccess = false;
    if (isLoggedIn()) {
      try {
        const role = await getCurrentUserRole();
        userHasDashboardAccess = canAccessRole(role, "staff");
      } catch {
        userHasDashboardAccess = false;
      }
    }
    if (isLoggedIn()) {
      authLink.textContent = "Logout";
      authLink.setAttribute("href", "#");
      authLink.onclick = async (e) => {
        e.preventDefault();
        if (logoutModal) {
          logoutModal.show();
        } else {
          await logout();
          window.location.reload();
        }
      };
    } else {
      authLink.textContent = "Login";
      authLink.setAttribute("href", loginHref(window.location.pathname));
      authLink.onclick = null;
    }
    if (adminNavItem) {
      adminNavItem.classList.add("d-none");
      if (isLoggedIn() && userHasDashboardAccess) adminNavItem.classList.remove("d-none");
    }
    if (accountNavItem) {
      accountNavItem.classList.add("d-none");
      if (isLoggedIn()) accountNavItem.classList.remove("d-none");
    }
  }
  await applyAuthState();
  onAuthChange(() => {
    applyAuthState();
    updateCartCount();
  });
  window.addEventListener("pp:cart-updated", () => {
    updateCartCount();
  });
  const year = document.getElementById("pp-year");
  if (year) year.textContent = String(new Date().getFullYear());
  await updateCartCount();
}

boot();

