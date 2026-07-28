export function toast(msg, type = "info") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const d = document.createElement("div");
  d.className = `toast ${type}`;
  d.innerHTML = msg;
  c.appendChild(d);
  setTimeout(() => {
    d.style.opacity = "0";
    d.style.transform = "translateY(-10px)";
    setTimeout(() => d.remove(), 300);
  }, 2000);
}
