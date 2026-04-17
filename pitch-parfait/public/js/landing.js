import { isLoggedIn, onAuthChange } from "./auth.js";

function initScrollReveal() {
  const revealTargets = [...document.querySelectorAll(".pp-reveal")];
  if (!revealTargets.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.15 }
  );
  revealTargets.forEach((el) => observer.observe(el));
}

function initSmoothAnchorLinks() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (event) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function syncHeroCta() {
  const cta = document.getElementById("pp-hero-auth-cta");
  if (!cta) return;
  if (isLoggedIn()) {
    cta.textContent = "Order Now";
    cta.setAttribute("href", "./pages/home.html");
    return;
  }
  cta.textContent = "Login To Order";
  cta.setAttribute("href", "./pages/login.html?next=./home.html");
}

function boot() {
  initScrollReveal();
  initSmoothAnchorLinks();
  syncHeroCta();
  onAuthChange(() => syncHeroCta());
}

boot();
