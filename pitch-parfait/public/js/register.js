import { isFirebaseConfigured } from "../lib/firebase.js";
import { signupWithConsent } from "./auth.js";
import { showToast } from "./ui.js";

function getNext() {
  const q = new URLSearchParams(window.location.search);
  return q.get("next") || "./home.html";
}

async function boot() {
  const warning = document.getElementById("pp-register-warning");
  const submitBtn = document.getElementById("pp-register-submit");
  if (!isFirebaseConfigured()) {
    warning.classList.remove("d-none");
    submitBtn.disabled = true;
    return;
  }

  const form = document.getElementById("pp-register-form");
  const consentCheck = document.getElementById("pp-privacy-consent-check");
  const openConsentBtn = document.getElementById("pp-open-consent-modal");
  const consentAcceptBtn = document.getElementById("pp-consent-accept-btn");
  const consentModalEl = document.getElementById("pp-consent-modal");
  const consentModal = window.bootstrap ? new window.bootstrap.Modal(consentModalEl) : null;

  openConsentBtn?.addEventListener("click", () => {
    consentModal?.show();
  });
  consentAcceptBtn?.addEventListener("click", () => {
    if (consentCheck) consentCheck.checked = true;
    consentModal?.hide();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("pp-name").value.trim();
    const email = document.getElementById("pp-email").value.trim();
    const pass = document.getElementById("pp-pass").value.trim();
    const pass2 = document.getElementById("pp-pass2").value.trim();
    if (!name || !email || !pass || !pass2) return;
    if (pass !== pass2) {
      showToast("Passwords do not match.", "warning");
      return;
    }
    if (!consentCheck?.checked) {
      showToast("You must provide data privacy consent before creating an account.", "warning");
      consentModal?.show();
      return;
    }
    try {
      await signupWithConsent(email, pass, name, {
        accepted: true,
        acceptedAt: new Date().toISOString(),
        version: "v1",
      });
      showToast("Account created! Redirecting...", "success");
      setTimeout(() => (window.location.href = getNext()), 800);
    } catch (err) {
      showToast(err?.message || "Registration failed.", "danger");
    }
  });
}

boot();

