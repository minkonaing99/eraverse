(() => {
  const form = document.querySelector("#inputRow form");
  const elProduct = document.getElementById("product");
  const elDuration = document.getElementById("duration");
  const elSupplier = document.getElementById("supplier");
  const elRenewable = document.getElementById("renewable");
  const elNote = document.getElementById("note");
  const elLink = document.getElementById("link");
  const elWholesale = document.getElementById("wholesale_amount");
  const elRetail = document.getElementById("retail_amount");
  const saveBtn = form?.querySelector('button[type="submit"]');
  const feedbackBox = document.getElementById("feedback_addProduct");

  // --- helpers from before ---
  function setDanger(el, on) {
    if (!el) return;
    el.classList.toggle("text-danger", !!on);
    const label = el.id
      ? document.querySelector(`label[for="${el.id}"]`)
      : null;
    if (label) label.classList.toggle("text-danger", !!on);
  }
  const toInt = (v) => {
    if (v === "" || v === null || v === undefined) return NaN;
    const n = Number(v);
    return Number.isInteger(n) ? n : NaN;
  };
  const toMoney = (v) => {
    if (v === "" || v === null || v === undefined) return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  };
  function parseRenewable(selectEl) {
    const raw = (selectEl?.value || "").trim().toLowerCase();
    if (raw === "yes") return true;
    if (raw === "no") return false;
    return null; // "Choose..."
  }

  // --- validation (unchanged behavior) ---
  function validateProductsCatalog() {
    const errors = {};

    const product = (elProduct.value || "").trim();
    if (!product) errors.product = true;
    setDanger(elProduct, !product);

    const duration = toInt(elDuration.value);
    if (!Number.isInteger(duration) || duration < 1) {
      errors.duration = true;
      setDanger(elDuration, true);
    } else {
      setDanger(elDuration, false);
    }

    const wholesale = toMoney(elWholesale.value);
    if (!Number.isFinite(wholesale) || wholesale < 0) {
      errors.wholesale_amount = true;
      setDanger(elWholesale, true);
    } else {
      setDanger(elWholesale, false);
    }

    const retail = toMoney(elRetail.value);
    if (!Number.isFinite(retail) || !(retail > wholesale)) {
      errors.retail_amount = true;
      setDanger(elRetail, true);
    } else {
      setDanger(elRetail, false);
    }

    const valid = Object.keys(errors).length === 0;
    if (saveBtn) {
      saveBtn.disabled = !valid;
      saveBtn.classList.toggle("disableBtn", !valid);
    }

    const renewableTri = parseRenewable(elRenewable);
    const finalName = formatProductName(product, duration);

    const values = valid
      ? {
          product_name: finalName, // <-- formatted
          duration,
          renew: renewableTri === true,
          supplier: (elSupplier.value || "").trim() || null,
          wholesale,
          retail,
          note: (elNote.value || "").trim() || null,
          link: (elLink.value || "").trim() || null,
        }
      : null;

    return { valid, values };
  }

  // --- saving state helpers ---
  function setSaving(on) {
    if (!saveBtn) return;
    saveBtn.disabled = on || saveBtn.disabled;
    saveBtn.classList.toggle("disableBtn", on || saveBtn.disabled);
  }
  function showFeedback(msg, ok = true) {
    if (!feedbackBox) return;
    feedbackBox.textContent = msg;
    feedbackBox.style.color = ok ? "green" : "red";
  }
  // Add this helper near the top with other helpers
  function formatProductName(rawName, duration) {
    // strip any trailing " (N M)" suffix first to avoid duplicates
    const base = (rawName || "").replace(/\s*\(\s*\d+\s*M\s*\)$/i, "").trim();
    return `${base} (${duration}m)`;
  }

  // --- live validation + submit ---
  function attachHandlers() {
    if (!form) return;

    [elProduct, elDuration, elWholesale, elRetail].forEach((el) => {
      el?.addEventListener("input", validateProductsCatalog);
      el?.addEventListener("blur", validateProductsCatalog);
    });
    elRenewable?.addEventListener("change", validateProductsCatalog);

    // initial state: disabled until valid
    validateProductsCatalog();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const { valid, values } = validateProductsCatalog();
      if (!valid) return;

      try {
        setSaving(true);
        showFeedback("Saving...", true);

        const resp = await fetch("./api/product_insertion.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.success) {
          throw new Error(data.error || `HTTP ${resp.status}`);
        }

        // success
        form.reset();
        validateProductsCatalog();

        // 1) show success for 1s
        if (feedbackBox) {
          feedbackBox.textContent = "Successfully Saved";
          feedbackBox.style.color = "white";
          feedbackBox.style.display = "block";
        }

        setTimeout(() => {
          // 2) hide feedback
          if (feedbackBox) feedbackBox.style.display = "none";

          // 3) hide the Add Product form
          const addProductForm = document.getElementById("addProductForm");
          if (addProductForm) addProductForm.style.display = "none";

          // 4) reload the table
          if (typeof window.refreshProductsTable === "function") {
            window.refreshProductsTable();
          }
        }, 1000);

        // Reload the products table
        if (typeof window.refreshProductsTable === "function") {
          window.refreshProductsTable();
        }
      } catch (err) {
        console.error("Save failed:", err);
        showFeedback(`Save failed: ${err.message}`, false);
      } finally {
        setSaving(false);
      }
    });
  }

  attachHandlers();

  // expose if you want to poke from console
  window.validateProductsCatalog = validateProductsCatalog;
})();

(() => {
  const API_LIST_URL = "./api/products_table.php";
  const API_DELETE_URL = "./api/product_delete.php";
  const API_UPDATE_URL = "./api/product_update.php";

  const tbody = document.getElementById("product_table");
  const COLSPAN = 10; // total columns

  // ---------- utils ----------
  const yn = (b) => (b ? "Yes" : "No");

  function formatKyat(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "-";
    return (
      new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        Math.round(num)
      ) + " Ks"
    );
  }

  function safeHref(url) {
    if (typeof url !== "string") return null;
    const s = url.trim();
    return /^https?:\/\//i.test(s) ? s : null;
  }

  function displayLinkText(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname && u.pathname !== "/" ? u.pathname : "");
    } catch {
      return url;
    }
  }

  function placeholderRow(text) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "era-muted";
    td.colSpan = COLSPAN;
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  }

  const svgTrash = () => `
    <span class="era-icon"><img src="./assets/delete.svg" alt=""></span>
  `;
  const svgEdit = () => `
    <span class="era-icon"><img src="./assets/edit.svg" alt=""></span>
  `;

  // ---------- render ----------
  function renderRows(rows) {
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.appendChild(placeholderRow("No products found."));
      return;
    }

    const frag = document.createDocumentFragment();

    rows.forEach((p, i) => {
      const tr = document.createElement("tr");
      tr.className = "era-row";
      if (p.product_id != null) tr.dataset.id = String(p.product_id);

      // 1) #
      const tdNum = document.createElement("td");
      tdNum.className = "era-num";
      tdNum.textContent = String(i + 1);

      // 2) product_name
      const tdProduct = document.createElement("td");
      tdProduct.className = "era-product";
      tdProduct.textContent = p.product_name ?? "-";

      // 3) duration badge
      const tdDur = document.createElement("td");
      tdDur.className = "era-dur";
      const badge = document.createElement("span");
      badge.className = "era-badge";
      badge.textContent = (p.duration ?? "-") + "";
      tdDur.appendChild(badge);

      // 4) supplier
      const tdSupplier = document.createElement("td");
      tdSupplier.className = "era-supplier";
      tdSupplier.textContent = p.supplier ?? "-";

      // 5) renew
      const tdRenew = document.createElement("td");
      tdRenew.className = "era-renew";
      tdRenew.textContent = yn(!!p.renew);

      // 6) note
      const tdNote = document.createElement("td");
      tdNote.className = "era-muted";
      tdNote.title = p.note ?? "";
      tdNote.textContent = p.note ?? "-";

      // 7) link (clickable if valid)
      const tdLink = document.createElement("td");
      tdLink.className = "era-muted";
      if (p.link) {
        const href = safeHref(p.link);
        if (href) {
          const a = document.createElement("a");
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = displayLinkText(href);
          a.title = href;
          tdLink.appendChild(a);
        } else {
          tdLink.textContent = p.link;
        }
      } else {
        tdLink.textContent = "-";
      }

      // 8) wholesale
      const tdWholesale = document.createElement("td");
      tdWholesale.className = "era-price";
      tdWholesale.textContent = formatKyat(p.wholesale);

      // 9) retail
      const tdRetail = document.createElement("td");
      tdRetail.className = "era-price";
      tdRetail.textContent = formatKyat(p.retail);

      // 10) actions
      const tdActions = document.createElement("td");
      tdActions.className = "era-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "era-icon-btn";
      editBtn.type = "button";
      editBtn.title = "Edit";
      editBtn.setAttribute("aria-label", `Edit row ${i + 1}`);
      editBtn.innerHTML = svgEdit();
      editBtn.addEventListener("click", () => openEditForm(p));

      const delBtn = document.createElement("button");
      delBtn.className = "era-icon-btn";
      delBtn.type = "button";
      delBtn.dataset.action = "delete"; // <-- REQUIRED for delegation
      delBtn.title = "Delete";
      delBtn.setAttribute("aria-label", `Delete row ${i + 1}`);
      delBtn.innerHTML = svgTrash();

      tdActions.append(editBtn, delBtn);

      tr.append(
        tdNum,
        tdProduct,
        tdDur,
        tdSupplier,
        tdRenew,
        tdNote,
        tdLink,
        tdWholesale,
        tdRetail,
        tdActions
      );
      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
  }

  async function loadProducts() {
    tbody.innerHTML = "";
    tbody.appendChild(placeholderRow("Loading…"));
    try {
      const r = await fetch(API_LIST_URL, {
        headers: { Accept: "application/json" },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok || !json.success)
        throw new Error(json.error || `HTTP ${r.status}`);
      renderRows(json.data || []);
    } catch (err) {
      console.error("Failed to load products:", err);
      tbody.innerHTML = "";
      tbody.appendChild(placeholderRow(`Failed to load: ${err.message}`));
    }
  }

  function renumberRows() {
    tbody.querySelectorAll("tr.era-row").forEach((tr, idx) => {
      const cell = tr.querySelector(".era-num");
      if (cell) cell.textContent = String(idx + 1);
    });
  }

  // ---------- delete (delegated) ----------
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest('button.era-icon-btn[data-action="delete"]');
    if (!btn) return;

    const tr = btn.closest("tr.era-row");
    if (!tr) return;

    const id = Number(tr.dataset.id);
    if (!id) return alert("Missing product_id for this row.");

    const name =
      tr.querySelector(".era-product")?.textContent?.trim() || `#${id}`;
    if (!confirm(`Delete "${name}"?\nThis cannot be undone.`)) return;

    btn.disabled = true;
    btn.classList.add("disableBtn");

    try {
      const resp = await fetch(API_DELETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.success)
        throw new Error(json.error || `HTTP ${resp.status}`);

      tr.remove();
      if (!tbody.querySelector("tr.era-row")) {
        tbody.innerHTML = "";
        tbody.appendChild(placeholderRow("No products found."));
      } else {
        renumberRows();
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert(`Delete failed: ${err.message}`);
      btn.disabled = false;
      btn.classList.remove("disableBtn");
    }
  });

  // ---------- edit ----------
  function setInput(el, val = "") {
    if (!el) return;
    el.value = val ?? "";
    el.defaultValue = el.value; // so form.reset() returns here
  }
  function setSelect(el, val) {
    // 'Yes' | 'No' | 'Choose...'
    if (!el) return;
    el.value = val;
    Array.from(el.options).forEach(
      (opt) => (opt.defaultSelected = opt.value === val)
    );
  }

  // open edit section and populate fields
  window.openEditForm = function openEditForm(p) {
    const editSec = document.getElementById("editProductForm");
    const addSec = document.getElementById("addProductForm");
    const userSec = document.getElementById("user_setting");
    if (addSec) addSec.style.display = "none";
    if (userSec) userSec.style.display = "none";
    if (editSec) editSec.style.display = "block";

    // Map DB -> UI
    setInput(document.getElementById("edit_product_id"), p.product_id ?? "");
    setInput(document.getElementById("edit_product"), p.product_name ?? "");
    setInput(document.getElementById("edit_duration"), p.duration ?? "");
    setInput(document.getElementById("edit_supplier"), p.supplier ?? ""); // was manager before
    setSelect(
      document.getElementById("edit_renewable"),
      p.renew ? "Yes" : "No"
    );
    setInput(document.getElementById("edit_note"), p.note ?? "");
    setInput(document.getElementById("edit_link"), p.link ?? "");
    setInput(
      document.getElementById("edit_wholesale_amount"),
      p.wholesale ?? ""
    );
    setInput(document.getElementById("edit_retail_amount"), p.retail ?? "");
  };

  // submit edit form (POST -> product_update.php)
  (function wireEditForm() {
    const form = document.getElementById("editForm");
    const box = document.getElementById("feedback_editProduct");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = Number(document.getElementById("edit_product_id").value);
      const name = document.getElementById("edit_product").value.trim();
      const duration = Number(document.getElementById("edit_duration").value);
      const supplier =
        document.getElementById("edit_supplier").value.trim() || null;
      const renew = document.getElementById("edit_renewable").value === "Yes";
      const note = document.getElementById("edit_note").value.trim() || null;
      let link = document.getElementById("edit_link").value.trim() || null;
      const wholesale = Number(
        document.getElementById("edit_wholesale_amount").value
      );
      const retail = Number(
        document.getElementById("edit_retail_amount").value
      );

      // normalize link like the server (accept "www...")
      if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;

      const payload = {
        id, // <-- API expects "id"
        product_name: name,
        duration,
        renew,
        supplier, // <-- not "manager"
        wholesale,
        retail,
        note, // <-- not "notes"
        link,
      };

      try {
        if (box) {
          box.style.display = "block";
          box.style.color = "";
          box.textContent = "Saving...";
        }
        const res = await fetch(API_UPDATE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));

        if (res.status === 422) {
          // show quick summary; wire per-field if you want
          const msg = json.errors
            ? Object.values(json.errors).join(" | ")
            : "Validation failed.";
          throw new Error(msg);
        }
        if (!res.ok || !json.success)
          throw new Error(json.error || `HTTP ${res.status}`);

        if (box) {
          box.textContent = "Successfully Saved";
        }
        setTimeout(() => {
          if (box) box.style.display = "none";
          const editSec = document.getElementById("editProductForm");
          if (editSec) editSec.style.display = "none";
          // refresh table with latest values
          if (typeof window.refreshProductsTable === "function")
            window.refreshProductsTable();
        }, 800);
      } catch (err) {
        console.error("Update failed:", err);
        if (box) {
          box.style.display = "block";
          box.style.color = "red";
          box.textContent = `Save failed: ${err.message}`;
        }
      }
    });
  })();

  // initial load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadProducts);
  } else {
    loadProducts();
  }

  // expose manual refresh
  window.refreshProductsTable = loadProducts;
})();
