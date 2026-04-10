import { isFirebaseConfigured } from "../lib/firebase.js";
import { signup } from "./auth.js";
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
    try {
      await signup(email, pass, name);
      showToast("Account created! Redirecting...", "success");
      setTimeout(() => (window.location.href = getNext()), 800);
    } catch (err) {
      showToast(err?.message || "Registration failed.", "danger");
    }
  });
}

boot();

