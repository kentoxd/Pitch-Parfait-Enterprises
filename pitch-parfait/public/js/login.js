import { isFirebaseConfigured } from "../lib/firebase.js";
import { login } from "./auth.js";
import { showToast } from "./ui.js";

function getNext() {
  const q = new URLSearchParams(window.location.search);
  return q.get("next") || "./home.html";
}

async function boot() {
  const warning = document.getElementById("pp-login-warning");
  if (!isFirebaseConfigured()) {
    warning.classList.remove("d-none");
    document.getElementById("pp-login-submit").disabled = true;
    return;
  }

  const form = document.getElementById("pp-login-form");
  const submit = async () => {
    const email = document.getElementById("pp-email").value.trim();
    const pass = document.getElementById("pp-pass").value.trim();
    if (!email || !pass) return;
    try {
      await login(email, pass);
      showToast("Welcome! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = getNext();
      }, 700);
    } catch (e) {
      showToast(e?.message || "Authentication failed.", "danger");
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submit();
  });
}

boot();

