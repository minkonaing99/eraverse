(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  function normalize(href) {
    try {
      const url = new URL(href, location.href);
      let p = url.pathname.toLowerCase().replace(/\/+$/, "");
      p = p.replace(/\/(index|default)\.(html|php)$/, ""); // treat index as folder
      return p || "/";
    } catch {
      return href;
    }
  }

  // -> "sales_overview.html" | "product_catalog.html" | "index"
  function pageKey(href) {
    const p = normalize(href);
    if (p === "/") return "index";
    const segs = p.split("/").filter(Boolean);
    return segs.pop() || "index";
  }

  function setActiveNav() {
    const hereKey = pageKey(location.pathname);

    $$("nav .nav-links a[href]").forEach((a) => {
      a.classList.remove("active");
      a.removeAttribute("aria-current");

      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:"))
        return;

      const targetKey = pageKey(href);
      if (hereKey === targetKey) {
        a.classList.add("active");
        a.setAttribute("aria-current", "page");
      }
    });
  }

  function initNavigationToggle() {
    const burger = $("#burger");
    const navLinks = $("#navLinks");
    if (!burger || !navLinks) return;

    burger.addEventListener("click", () => {
      burger.classList.toggle("open");
      navLinks.classList.toggle("active");
    });

    $$("nav .nav-links a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        burger.classList.remove("open");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigationToggle();
    setActiveNav();
  });
  document.addEventListener("DOMContentLoaded", setActiveNav);

  window.addEventListener("popstate", setActiveNav);
  window.addEventListener("hashchange", setActiveNav);
})();

document.getElementById("logoutBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!confirm("Are you sure you want to log out?")) return;

  try {
    const resp = await fetch("./api/logout.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" }, // optional, but nice
    });

    if (resp.ok) {
      window.location.href = "./index.php";
    } else {
      console.error("Logout failed", await resp.text());
      alert("Logout failed. Try again.");
    }
  } catch (err) {
    console.error("Logout failed", err);
    alert("Network error during logout.");
  }
});
