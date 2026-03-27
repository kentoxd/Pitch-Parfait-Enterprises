export async function injectComponent(targetId, url) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const res = await fetch(url, { cache: "no-cache" });
  target.innerHTML = await res.text();
}

export async function injectChrome(prefix) {
  await injectComponent("pp-navbar", `${prefix}components/navbar.html`);
  await injectComponent("pp-footer", `${prefix}components/footer.html`);
}

