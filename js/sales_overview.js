"use strict";

/* -----------------------------
   Small utilities (global)
----------------------------- */
function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* -----------------------------
   Add Sale section toggle + search UI
----------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Toggle add-sales section
  const addSaleBtn = document.getElementById("addSaleBtn");
  const addSalesSection = document.getElementById("add_sales");
  if (addSalesSection) addSalesSection.style.display = "none";
  if (addSaleBtn && addSalesSection) {
    addSaleBtn.addEventListener("click", () => {
      addSalesSection.style.display =
        addSalesSection.style.display === "none" ? "block" : "none";
    });
  }

  // Search reveal/hide
  const btn = document.getElementById("searchBtn");
  const wrap = document.getElementById("searchCustomerWrapper");
  const input = document.getElementById("search_customer");
  if (btn && wrap && input) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      btn.classList.add("is-hidden");
      wrap.classList.add("is-visible");
      setTimeout(() => input.focus(), 10);
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        input.value = "";
        wrap.classList.remove("is-visible");
        btn.classList.remove("is-hidden");
      }, 120);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        input.value = "";
        input.blur();
      }
    });
  }
});

// Manual refresh button (optional)
document
  .getElementById("refreshBtn")
  ?.addEventListener("click", async function () {
    this.style.setProperty("display", "none", "important");
    this.disabled = true;
    try {
      await (window.refreshSalesTable?.() ?? Promise.resolve());
    } finally {
      setTimeout(() => {
        this.disabled = false;
        this.style.setProperty("display", "inline-block", "important");
      }, 5000);
    }
  });

/* -----------------------------
   Sales table: cache-first + 100-per-view + daily subtotals + inline edit
----------------------------- */
/* -----------------------------
   Sales table: cache-first + 100-per-view + daily subtotals + inline edit + client search
----------------------------- */
/* -----------------------------
   Sales table: cache-first + 100-per-view + daily subtotals
   + inline edit (dblclick) + client-side search (debounced) with precomputed key
----------------------------- */
(() => {
  const API_LIST_URL = "api/sales_table.php";
  const API_DELETE_URL = "api/sale_delete.php";
  const API_INLINE_URL = "api/sale_update_inline.php";

  const tbody = document.getElementById("sales_table");
  if (!tbody) return; // not on this page

  const COLSPAN = 12;
  const CACHE_KEY = "cachedSales:v1";
  const PAGE_SIZE = 100;

  // --- paging / data state ---
  let allRows = []; // master dataset (from API / cache)
  let flatRows = []; // rows currently being rendered (filtered view)
  let renderedCount = 0;
  let io = null;

  // --- totals state (for subtotals) ---
  let totalsByDate = new Map();
  let countsByDate = new Map();
  let renderedByDate = new Map();
  let rowNumBase = 0;

  // --- inline editor state ---
  let activeEditor = null; // { td, input, span, prev }

  // --- search state ---
  let currentQuery = ""; // the text currently filtering the table

  // ---------------- helpers ----------------
  const yn = (b) => (b ? "Yes" : "No");
  const svgTrash = () =>
    `<span class="era-icon"><img src="./assets/delete.svg" alt=""></span>`;

  function formatKyat(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "-";
    return (
      new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        Math.round(num)
      ) + " Ks"
    );
  }
  function formatDate(d) {
    if (!d) return "-";
    const parts = String(d).split("-");
    if (parts.length !== 3) return "-";
    const dt = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(dt);
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

  // simple trailing debounce (used for search)
  function debounce(fn, ms = 1000) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // Build a single lowecase search string per row for fast filter
  function buildSearchKey(r) {
    r._q = [
      r.customer ?? "",
      r.email ?? "",
      r.sale_product ?? "",
      r.manager ?? "",
    ]
      .join("|")
      .toLowerCase();
  }

  // Update in-memory + session copy for a single row, also rebuild _q if searchable fields changed
  function updateLocalRow(id, patch) {
    const idStr = String(id);
    const touchesSearch =
      "customer" in patch ||
      "email" in patch ||
      "manager" in patch ||
      "sale_product" in patch ||
      "renew" in patch;

    // update in-memory
    allRows = allRows.map((r) => {
      if (String(r.sale_id) === idStr) {
        const nr = { ...r, ...patch };
        if (touchesSearch) buildSearchKey(nr);
        return nr;
      }
      return r;
    });

    // update session cache
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        const idx = data.findIndex((r) => String(r.sale_id) === idStr);
        if (idx >= 0) {
          data[idx] = { ...data[idx], ...patch };
          if (touchesSearch) buildSearchKey(data[idx]);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        }
      } catch {}
    }
  }

  // ---------------- row builders ----------------
  function buildSaleTr(s, displayNum) {
    const tr = document.createElement("tr");
    tr.className = "era-row";
    if (s.sale_id != null) tr.dataset.id = String(s.sale_id);

    const tdNum = document.createElement("td");
    tdNum.className = "era-num";
    tdNum.textContent = String(displayNum);

    const tdProd = document.createElement("td");
    tdProd.textContent = s.sale_product ?? "-";

    const tdDur = document.createElement("td");
    tdDur.className = "era-dur";
    tdDur.innerHTML = `<span class="era-badge">${s.duration ?? "-"}</span>`;

    const tdRenew = document.createElement("td");
    tdRenew.className = "era-renew";
    const renewInt = Number.isInteger(+s.renew) ? +s.renew : 0;
    tdRenew.textContent = String(renewInt);

    const makeEditable = (field, text, extraClass = "") => {
      const td = document.createElement("td");
      td.className =
        `td-scrollable editable-cell editable-${field} ${extraClass}`.trim();
      td.dataset.id = String(s.sale_id || "");
      td.dataset.field = field;
      const span = document.createElement("span");
      span.className = "inline-text";
      span.textContent = text ?? "-";
      td.appendChild(span);
      if (field === "note") td.title = text ?? "";
      return td;
    };

    const tdCustomer = makeEditable("customer", s.customer);
    const tdEmail = makeEditable("email", s.email, "era-muted");

    const tdPurchased = document.createElement("td");
    tdPurchased.className = "text-center";
    tdPurchased.textContent = formatDate(s.purchased_date);

    const tdExpired = document.createElement("td");
    tdExpired.className = "text-center";
    tdExpired.textContent = formatDate(s.expired_date);

    const tdManager = makeEditable("manager", s.manager);
    const tdNote = makeEditable("note", s.note, "era-muted");

    const tdPrice = document.createElement("td");
    tdPrice.className = "era-price";
    tdPrice.textContent = formatKyat(s.price);

    const tdActions = document.createElement("td");
    tdActions.className = "era-actions";
    const delBtn = document.createElement("button");
    delBtn.className = "era-icon-btn";
    delBtn.type = "button";
    delBtn.dataset.action = "delete";
    delBtn.title = "Delete";
    delBtn.setAttribute("aria-label", `Delete row ${displayNum}`);
    delBtn.innerHTML = svgTrash();
    tdActions.appendChild(delBtn);

    tr.append(
      tdNum,
      tdProd,
      tdDur,
      tdRenew,
      tdCustomer,
      tdEmail,
      tdPurchased,
      tdExpired,
      tdManager,
      tdNote,
      tdPrice,
      tdActions
    );
    return tr;
  }

  function buildSubtotalTr(dateKey) {
    const tr = document.createElement("tr");
    tr.className = "era-row era-subtotal";
    const tdLabel = document.createElement("td");
    tdLabel.colSpan = 10;
    tdLabel.textContent = `Total for ${formatDate(dateKey)}`;
    const tdSum = document.createElement("td");
    tdSum.className = "era-price";
    tdSum.textContent = formatKyat(totalsByDate.get(dateKey) || 0);
    const tdEmpty = document.createElement("td");
    tr.append(tdLabel, tdSum, tdEmpty);
    return tr;
  }

  function buildDailyStats(rows) {
    totalsByDate = new Map();
    countsByDate = new Map();
    renderedByDate = new Map();
    rows.forEach((r) => {
      const d = r.purchased_date || "";
      const p = Number(r.price) || 0;
      totalsByDate.set(d, (totalsByDate.get(d) || 0) + p);
      countsByDate.set(d, (countsByDate.get(d) || 0) + 1);
    });
  }

  // ---------------- inline editing ----------------
  function startInlineEdit(td) {
    if (!td || td.classList.contains("editing")) return;

    // close other editor
    if (activeEditor && activeEditor.td !== td) cancelInline(activeEditor.td);

    const span = td.querySelector(".inline-text");
    if (!span) return;

    const field = td.dataset.field; // customer|email|manager|note
    const initial = (span.textContent || "").trim();

    td.classList.add("editing");
    span.style.display = "none";

    const input = document.createElement("input");
    input.type = field === "email" ? "email" : "text";
    input.className = "form-control form-control-sm inline-input";
    input.value = initial === "-" ? "" : initial;
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    td.appendChild(input);
    activeEditor = { td, input, span, prev: initial };

    input.focus();
    input.select();
  }

  function cancelInline(td) {
    if (!td || !td.classList.contains("editing")) return;
    const input = td.querySelector(".inline-input");
    const span = td.querySelector(".inline-text");

    if (input) td.removeChild(input);
    if (span) {
      span.textContent = activeEditor?.prev ?? span.textContent;
      span.style.display = "";
    }

    if (td.dataset.field === "note") {
      td.title = activeEditor?.prev || "";
    }

    td.classList.remove("editing");
    if (activeEditor?.td === td) activeEditor = null;
  }

  async function saveInline(td) {
    const input = td.querySelector(".inline-input");
    const span = td.querySelector(".inline-text");
    const id = td.dataset.id;
    const field = td.dataset.field;
    if (!input || !span || !id || !field) return;

    const next = input.value.trim();
    const prev = activeEditor?.prev ?? span.textContent.trim();

    // no change → just show and exit
    if (next === prev) {
      td.removeChild(input);
      span.style.display = "";
      td.classList.remove("editing");
      if (activeEditor?.td === td) activeEditor = null;
      return;
    }

    // tiny validation
    if (field === "email" && next && !/^\S+@\S+\.\S+$/.test(next)) {
      alert("Please enter a valid email.");
      input.focus();
      return;
    }
    if (field === "customer" && !next) {
      alert("Customer cannot be empty.");
      input.focus();
      return;
    }

    // optimistic UI
    span.textContent = next || "-";
    span.style.display = "";
    if (field === "note") td.title = next || "";
    td.removeChild(input);
    td.classList.remove("editing");
    if (activeEditor?.td === td) activeEditor = null;

    // update local + cache copy
    updateLocalRow(id, { [field]: next || null });

    // persist to backend
    try {
      const payload = { id };
      payload[field] = next || null;
      const res = await fetch(API_INLINE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success)
        throw new Error(json.error || `HTTP ${res.status}`);

      // keep filtered view consistent (row may fall out/in due to edit)
      if (currentQuery) {
        renderRowsProgressive(filterRowsByQuery(allRows, currentQuery));
      }
    } catch (err) {
      // rollback on error
      span.textContent = prev || "-";
      if (field === "note") td.title = prev || "";
      updateLocalRow(id, { [field]: prev || null });
      alert(`Failed to save ${field}: ${err.message}`);
    }
  }

  function initInlineEditing() {
    tbody.addEventListener("dblclick", (e) => {
      const td = e.target.closest(".editable-cell");
      if (td) startInlineEdit(td);
    });

    tbody.addEventListener("keydown", (e) => {
      if (!e.target.matches(".inline-input")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        const td = e.target.closest(".editable-cell");
        if (td) saveInline(td);
      } else if (e.key === "Escape") {
        const td = e.target.closest(".editable-cell");
        if (td) cancelInline(td);
      }
    });

    // blur cancels (do not save on blur)
    tbody.addEventListener(
      "blur",
      (e) => {
        if (e.target.matches(".inline-input")) {
          const td = e.target.closest(".editable-cell");
          setTimeout(() => td && cancelInline(td), 100);
        }
      },
      true
    );
  }

  // ---------------- search (client-side, cached) ----------------
  function filterRowsByQuery(rows, q) {
    if (!q) return rows;
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => (r._q || "").includes(ql));
  }

  function applySearchRender() {
    const input = document.getElementById("search_customer");
    currentQuery = (input?.value || "").trim();
    renderRowsProgressive(filterRowsByQuery(allRows, currentQuery));
  }

  function setupCustomerSearch() {
    const input = document.getElementById("search_customer");
    if (!input) return;

    // 1s debounce while typing
    input.addEventListener("input", debounce(applySearchRender, 1000));

    // Enter triggers immediate search
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applySearchRender();
      }
    });

    // When your UI hides/clears the input, reset the view
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (!input.value) {
          currentQuery = "";
          renderRowsProgressive(allRows);
        }
      }, 140);
    });
  }

  // ---------------- rendering ----------------
  function appendNextChunk() {
    if (renderedCount >= flatRows.length) return;

    const frag = document.createDocumentFragment();
    const start = renderedCount;
    const end = Math.min(flatRows.length, start + PAGE_SIZE);

    for (let i = start; i < end; i++) {
      const s = flatRows[i];
      const d = s.purchased_date || "";

      frag.appendChild(buildSaleTr(s, ++rowNumBase));

      renderedByDate.set(d, (renderedByDate.get(d) || 0) + 1);
      const finished = renderedByDate.get(d) === (countsByDate.get(d) || 0);
      if (finished) frag.appendChild(buildSubtotalTr(d));
    }

    tbody.appendChild(frag);
    renderedCount = end;

    if (renderedCount >= flatRows.length && io) {
      io.disconnect();
      io = null;
    }
  }

  function renderRowsProgressive(rows) {
    tbody.innerHTML = "";
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.appendChild(placeholderRow("No sales found."));
      flatRows = [];
      return;
    }

    flatRows = rows.slice();
    buildDailyStats(flatRows);

    renderedCount = 0;
    rowNumBase = 0;
    appendNextChunk();

    const sentinel = document.getElementById("scrollSentinel");
    if (!sentinel) return;

    if (io) io.disconnect();
    io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.isIntersecting && appendNextChunk()),
      { root: null, rootMargin: "0px 0px 200px 0px", threshold: 0 }
    );
    io.observe(sentinel);
  }

  // ---------------- data ----------------
  async function fetchSalesFromNetwork() {
    const r = await fetch(API_LIST_URL, {
      headers: { Accept: "application/json" },
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json.success)
      throw new Error(json.error || `HTTP ${r.status}`);
    return json.data || [];
  }

  async function loadSales() {
    tbody.innerHTML = "";
    tbody.appendChild(placeholderRow("Loading…"));

    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        allRows = Array.isArray(data) ? data : [];
        allRows.forEach(buildSearchKey);
        renderRowsProgressive(filterRowsByQuery(allRows, currentQuery));

        // warm refresh in background
        fetchSalesFromNetwork()
          .then((fresh) => {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
            allRows = Array.isArray(fresh) ? fresh : [];
            allRows.forEach(buildSearchKey);
            renderRowsProgressive(filterRowsByQuery(allRows, currentQuery));
          })
          .catch(() => {});
        return;
      } catch {
        sessionStorage.removeItem(CACHE_KEY);
      }
    }

    try {
      const fresh = await fetchSalesFromNetwork();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      allRows = Array.isArray(fresh) ? fresh : [];
      allRows.forEach(buildSearchKey);
      renderRowsProgressive(filterRowsByQuery(allRows, currentQuery));
    } catch (err) {
      console.error("Failed to load sales:", err);
      tbody.innerHTML = "";
      tbody.appendChild(placeholderRow(`Failed to load: ${err.message}`));
    }
  }

  function refreshCacheAndReload() {
    sessionStorage.removeItem(CACHE_KEY);
    return loadSales();
  }

  // ---------------- delete (delegated) ----------------
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest('button.era-icon-btn[data-action="delete"]');
    if (!btn) return;

    const tr = btn.closest("tr.era-row");
    if (!tr) return;

    const id = Number(tr.dataset.id);
    if (!id) return alert("Missing sale_id for this row.");

    const name = tr.children[1]?.textContent?.trim() || `#${id}`;
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
      await refreshCacheAndReload(); // keeps subtotals/numbering right
    } catch (err) {
      console.error("Delete failed:", err);
      alert(`Delete failed: ${err.message}`);
      btn.disabled = false;
      btn.classList.remove("disableBtn");
    }
  });

  // ---------------- init ----------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadSales);
  } else {
    loadSales();
  }
  setupCustomerSearch(); // <-- enable client-side search (debounced + precomputed)
  initInlineEditing();
  window.refreshSalesTable = refreshCacheAndReload;
})();

/* -----------------------------
   Add Sale form: validation + insert + cache refresh
----------------------------- */
(async () => {
  const $ = (id) => document.getElementById(id);

  const form = document.querySelector(".inputSalesForm form");
  if (!form) return;

  const elProduct = $("product");
  const elCustomer = $("customer");
  const elEmail = $("email");
  const elPurchase = $("purchase_date");
  const elSeller = $("seller");
  const elAmount = $("amount");
  const elNotes = $("Notes");
  const elRenew = $("renew");
  const elDuration = $("duration");
  const elEndDate = $("end_date");
  const saveBtn = form.querySelector('button[type="submit"]');
  const feedback = $("feedback_addSale");

  const setDanger = (el, on) => {
    if (!el) return;
    el.classList.toggle("text-danger", !!on);
    const label = el.id
      ? document.querySelector(`label[for="${el.id}"]`)
      : null;
    if (label) label.classList.toggle("text-danger", !!on);
  };
  const toInt = (v) => (v === "" || v == null ? NaN : parseInt(v, 10));
  const toMoney = (v) =>
    v === "" || v == null ? NaN : Math.round(Number(v) * 100) / 100;

  function computeEndDate(ymd, months) {
    if (!ymd || !Number.isFinite(months)) return "";
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return "";
    const start = new Date(Date.UTC(y, m - 1, d));
    const target = new Date(start);
    const origDay = target.getUTCDate();
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + months);
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
    ).getUTCDate();
    target.setUTCDate(Math.min(origDay, lastDay));
    const yy = target.getUTCFullYear();
    const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(target.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function setBtn(valid) {
    if (!saveBtn) return;
    saveBtn.disabled = !valid;
    saveBtn.classList.toggle("disableBtn", !valid);
  }
  function showFeedback(msg, ok = true) {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.style.color = ok ? "white" : "red";
    feedback.style.display = "block";
  }

  // Product options
  const OPTIONS_URL = "./api/product_options.php"; // adjust if different
  async function loadProductOptions() {
    try {
      const r = await fetch(OPTIONS_URL, {
        headers: { Accept: "application/json" },
        method: "POST",
      });
      const data = await r.json().catch(() => ({}));
      if (!elProduct) return;
      elProduct.replaceChildren(new Option("Choose...", "", true, false));
      if (data.status === "success" && Array.isArray(data.products)) {
        for (const p of data.products) {
          const opt = new Option(p.product_name, p.product_id);
          opt.dataset.duration = p.duration; // months
          opt.dataset.price = p.retail_price; // retail
          opt.dataset.wcPrice = p.wc_price; // wholesale
          opt.dataset.renew = String(p.renew); // <-- keep 0/1/2/3/4/5/12
          elProduct.add(opt);
        }
      }
    } catch {
      // optional: toast/log
    }
  }

  // Validation
  function validate() {
    const opt = elProduct?.selectedOptions?.[0];
    const hasProduct = !!(opt && opt.value && !opt.disabled);
    setDanger(elProduct, !hasProduct);

    const customer = (elCustomer?.value || "").trim();
    setDanger(elCustomer, !customer);

    const pdate = elPurchase?.value;
    setDanger(elPurchase, !pdate);

    const valid = !!(hasProduct && customer && pdate);
    setBtn(valid);
    return valid;
  }

  function onProductChange() {
    const opt = elProduct?.selectedOptions?.[0];
    if (!opt || !opt.value) {
      if (elRenew) elRenew.value = "";
      if (elDuration) elDuration.value = "";
      if (elEndDate) elEndDate.value = "";
      setBtn(false);
      return;
    }

    const duration = toInt(opt.dataset.duration);
    const renewInt = toInt(opt.dataset.renew);

    if (elRenew)
      elRenew.value = Number.isInteger(renewInt) ? String(renewInt) : "0";
    if (elDuration)
      elDuration.value = Number.isFinite(duration) ? String(duration) : "";

    if (elEndDate) {
      elEndDate.value =
        elPurchase?.value && Number.isFinite(duration)
          ? computeEndDate(elPurchase.value, duration)
          : "";
    }

    validate();
  }

  function onPurchaseDateChange() {
    const opt = elProduct?.selectedOptions?.[0];
    const duration = toInt(elDuration?.value) || toInt(opt?.dataset.duration);
    if (elEndDate) {
      elEndDate.value =
        elPurchase?.value && Number.isFinite(duration)
          ? computeEndDate(elPurchase.value, duration)
          : "";
    }
    validate();
  }

  // Init
  if (elPurchase && !elPurchase.value) elPurchase.value = todayDate();
  await loadProductOptions();
  validate();

  elProduct?.addEventListener("change", onProductChange);
  elCustomer?.addEventListener("input", validate);
  elPurchase?.addEventListener("change", onPurchaseDateChange);

  // Submit
  // Allowed renew integers for sales insert
  const ALLOWED_RENEW_SALE = new Set([0, 1, 2, 3, 4, 5, 6, 12]);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const opt = elProduct.selectedOptions[0];
    const saleName = opt.textContent.trim();
    const duration = toInt(elDuration?.value) || toInt(opt.dataset.duration);
    const retail = toMoney(opt.dataset.price);
    const wholesale = toMoney(opt.dataset.wcPrice);
    const typedAmt = toMoney(elAmount?.value);

    let price, profit;
    if (Number.isFinite(typedAmt)) {
      price = typedAmt;
      profit = Number.isFinite(wholesale)
        ? Math.round((price - wholesale) * 100) / 100
        : null;
    } else {
      price = Number.isFinite(retail) ? retail : null;
      profit =
        Number.isFinite(wholesale) && Number.isFinite(retail)
          ? Math.round((retail - wholesale) * 100) / 100
          : null;
    }

    if (price == null || profit == null) {
      showFeedback(
        "Missing product pricing data to compute price/profit.",
        false
      );
      return;
    }

    // before payload:
    const chosenRenew = toInt(elRenew?.value);
    const productRenew = toInt(elProduct?.selectedOptions?.[0]?.dataset?.renew);
    const finalRenew = ALLOWED_RENEW_SALE.has(chosenRenew)
      ? chosenRenew
      : ALLOWED_RENEW_SALE.has(productRenew)
      ? productRenew
      : 0;

    // payload:
    const payload = {
      sale_product: saleName,
      duration: Number.isFinite(duration) ? duration : null,
      renew: finalRenew, // strict integer, never boolean
      customer: (elCustomer?.value || "").trim(),
      email: (elEmail?.value || "").trim() || null,
      purchased_date: elPurchase?.value,
      expired_date: elEndDate?.value || null,
      manager: (elSeller?.value || "").trim() || null,
      note: (elNotes?.value || "").trim() || null,
      price,
      profit,
    };

    try {
      showFeedback("Saving...", true);
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add("disableBtn");
      }

      const resp = await fetch("api/sale_insertion.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));

      if (resp.status === 422) {
        const msg = json.errors
          ? Object.values(json.errors).join(" | ")
          : "Validation failed.";
        throw new Error(msg);
      }
      if (!resp.ok || !json.success)
        throw new Error(json.error || `HTTP ${resp.status}`);

      showFeedback("Successfully Saved", true);
      setTimeout(() => {
        if (feedback) feedback.style.display = "none";
        const container = document.querySelector("#add_sales");
        if (container) container.style.display = "none";
      }, 800);

      // refresh table (cache invalidation inside)
      if (typeof window.refreshSalesTable === "function") {
        await window.refreshSalesTable();
      }

      // Reset fields
      form.reset();
      if (elProduct) elProduct.selectedIndex = 0;
      if (elPurchase) elPurchase.value = todayDate();
      if (elEndDate) elEndDate.value = "";
      validate();
    } catch (err) {
      console.error("Sale save failed:", err);
      showFeedback(`Save failed: ${err.message}`, false);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove("disableBtn");
      }
    }
  });
})();
