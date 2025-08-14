(() => {
  "use strict";

  // ------------------------------ Config ------------------------------
  const API_URL = "api/sales_minimal.php";

  // ------------------------------ Date utils (UTC-only) ------------------------------
  const msPerDay = 86_400_000;

  /** Parse 'YYYY-MM-DD' to a UTC Date, or null */
  const toUTC = (ymd) => {
    if (!ymd || typeof ymd !== "string") return null;
    const [y, m, d] = ymd.split("-").map((n) => Number(n));
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d))
      return null;
    return new Date(Date.UTC(y, m - 1, d));
  };

  const ymd = (dtUTC) => {
    const y = dtUTC.getUTCFullYear();
    const m = String(dtUTC.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dtUTC.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayUTC = (() => {
    const t = new Date();
    return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  })();

  const daysBetween = (aUTC, bUTC) => Math.round((aUTC - bUTC) / msPerDay);

  const lastDayOf = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

  const addMonthsUTC = (baseUTC, delta) => {
    const y = baseUTC.getUTCFullYear();
    const m = baseUTC.getUTCMonth();
    const d = baseUTC.getUTCDate();
    const tgt = m + delta;
    const y2 = y + Math.floor(tgt / 12);
    const m2 = ((tgt % 12) + 12) % 12;
    const d2 = Math.min(d, lastDayOf(y2, m2));
    return new Date(Date.UTC(y2, m2, d2));
  };

  const fmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const fmtDate = (ymdStr) => {
    const dt = toUTC(ymdStr);
    return dt ? fmt.format(dt) : "-";
  };

  const leftLabel = (n) => (n <= 0 ? "Today" : n === 1 ? "1 day" : `${n} days`);

  // ------------------------------ DOM helpers ------------------------------
  const qs = (id) => document.getElementById(id) || null;

  const placeholderRow = (text, colspan = 7) => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "era-muted";
    td.colSpan = colspan;
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  };

  const setLoading = (tbody, text = "Loading…") => {
    if (!tbody) return;
    tbody.innerHTML = "";
    tbody.appendChild(placeholderRow(text));
  };

  const setMobilePlaceholder = (el, text) => {
    if (!el) return;
    el.innerHTML = `<div class="subs-card era-muted" style="text-align:center;">${text}</div>`;
  };

  // ------------------------------ Business logic ------------------------------
  const within3Days = (dtUTC) => {
    const d = daysBetween(dtUTC, todayUTC);
    return d >= 0 && d < 4 ? d : null;
  };

  const computeExpiryUTC = (purchasedYMD, duration) => {
    const p = toUTC(purchasedYMD);
    if (!p || !Number.isInteger(duration) || duration < 1) return null;
    return addMonthsUTC(p, duration);
  };

  const nextDueFromAnchor = (purchaseYMD, renewMonths, base = todayUTC) => {
    const p = toUTC(purchaseYMD);
    if (!p || !Number.isInteger(renewMonths) || renewMonths <= 0) return null;
    let due = addMonthsUTC(p, renewMonths);
    while (due < base) due = addMonthsUTC(due, renewMonths);
    return due;
  };

  // ------------------------------ Selection & shaping ------------------------------
  function selectExpireSoon(rows) {
    return (rows || [])
      .map((r) => {
        const expUTC = toUTC(r.expired_date);
        if (!expUTC) return null;
        const left = within3Days(expUTC);
        return left === null ? null : { ...r, _days: left };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          a._days - b._days ||
          String(a.expired_date).localeCompare(String(b.expired_date))
      );
  }

  function selectNeedRenew(rows) {
    const out = [];
    (rows || []).forEach((r) => {
      const renew = Number.isFinite(+r.renew) ? parseInt(r.renew, 10) : 0;
      if (!Number.isInteger(renew) || renew <= 0) return;

      const duration = Number.isFinite(+r.duration)
        ? parseInt(r.duration, 10)
        : null;
      if (Number.isInteger(duration) && renew >= duration) return;

      const purUTC = toUTC(r.purchased_date);
      if (!purUTC) return;

      const expUTC =
        toUTC(r.expired_date) || computeExpiryUTC(r.purchased_date, duration);

      // Skip if already in "expire soon"
      if (expUTC) {
        const dToExp = within3Days(expUTC);
        if (dToExp !== null) return;
      }

      const due = nextDueFromAnchor(r.purchased_date, renew, todayUTC);
      if (!due) return;

      // Respect last cutoff relative to expiry (can't renew past final expiry window)
      if (expUTC) {
        const lastCutoff = addMonthsUTC(expUTC, -renew);
        if (due > lastCutoff) return;
      }

      if (due < purUTC) return;

      const left = within3Days(due);
      if (left === null) return;

      out.push({
        sale_product: r.sale_product,
        customer: r.customer,
        email: r.email,
        purchased_date: r.purchased_date,
        next_due: ymd(due),
        expiry_ymd: expUTC ? ymd(expUTC) : null,
        left,
        renew,
      });
    });

    return out.sort(
      (a, b) => a.left - b.left || a.next_due.localeCompare(b.next_due)
    );
  }

  // ------------------------------ Renderers ------------------------------
  function renderExpireSoonDesktop(rows) {
    const tbody = qs("expire_soon");
    if (!tbody) return;
    tbody.innerHTML = "";

    const soon = selectExpireSoon(rows);
    if (soon.length === 0) {
      tbody.appendChild(
        placeholderRow("No subscriptions expiring within 3 days.")
      );
      return;
    }

    const frag = document.createDocumentFragment();
    soon.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.className = "era-row";
      tr.innerHTML = `
        <td class="era-num">${i + 1}</td>
        <td>${r.sale_product ?? "-"}</td>
        <td style="text-align: center;">${r.customer ?? "-"}</td>
        <td>${r.email ?? "-"}</td>
        <td style="text-align: center;">${fmtDate(r.purchased_date)}</td>
        <td style="text-align: center;">${fmtDate(r.expired_date)}</td>
        <td style="text-align: right;">${leftLabel(r._days)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function renderNeedRenewDesktop(rows) {
    const tbody = qs("need_renew");
    if (!tbody) return;
    tbody.innerHTML = "";

    const out = selectNeedRenew(rows);
    if (out.length === 0) {
      tbody.appendChild(placeholderRow("No renewals due within 3 days."));
      return;
    }

    const frag = document.createDocumentFragment();
    out.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.className = "era-row";
      tr.innerHTML = `
        <td class="era-num">${i + 1}</td>
        <td>${r.sale_product ?? "-"}</td>
        <td style="text-align: center;">${r.customer ?? "-"}</td>
        <td>${r.email ?? "-"}</td>
        <td style="text-align: center;">${fmtDate(r.purchased_date)}</td>
        <td style="text-align: center;">${fmtDate(r.next_due)}</td>
        <td style="text-align: center;">${fmtDate(r.expiry_ymd)}</td>
        <td style="text-align: right;">${leftLabel(r.left)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function renderExpireSoonMobile(rows) {
    const wrap = qs("expired-item");
    if (!wrap) return;
    wrap.innerHTML = "";

    const soon = selectExpireSoon(rows);
    if (soon.length === 0) {
      setMobilePlaceholder(wrap, "No subscriptions expiring within 3 days.");
      return;
    }

    const frag = document.createDocumentFragment();
    soon.forEach((r) => {
      const card = document.createElement("div");
      card.className = "subs-card";
      card.innerHTML = `
        <div class="subs-row subs-row-top">
          <div class="subs-product">${r.sale_product ?? "-"}</div>
        </div>
        <div class="subs-row subs-name">
          <span class="subs-label">Name:</span>
          <span>${r.customer ?? "-"}</span>
        </div>
        <div class="subs-row subs-email">
          <span class="subs-label">Email:</span>
          <span>${r.email ?? "-"}</span>
        </div>
        <div class="subs-row subs-dates">
          <div class="subs-purchased">
            <span class="subs-label">Purchased:</span>
            <span>${fmtDate(r.purchased_date)}</span>
          </div>
          <div class="subs-expire">
            <span class="subs-label">Expire:</span>
            <span>${fmtDate(r.expired_date)}</span>
          </div>
        </div>
        <div class="subs-row subs-price">
          <span class="subs-label">Day Left:</span>
          <span>${leftLabel(r._days)}</span>
        </div>
      `;
      frag.appendChild(card);
    });
    wrap.appendChild(frag);
  }

  function renderNeedRenewMobile(rows) {
    const wrap = qs("renewal-item");
    if (!wrap) return;
    wrap.innerHTML = "";

    const out = selectNeedRenew(rows);
    if (out.length === 0) {
      setMobilePlaceholder(wrap, "No renewals due within 3 days.");
      return;
    }

    const frag = document.createDocumentFragment();
    out.forEach((r) => {
      const card = document.createElement("div");
      card.className = "subs-card";
      card.innerHTML = `
        <div class="subs-row subs-row-top">
          <div class="subs-product">${r.sale_product ?? "-"}</div>
          <div class="subs-renew"><span class="subs-label">Every</span><span>${
            r.renew
          }</span><span class="subs-label">Months</span></div>
        </div>
        <div class="subs-row subs-name">
          <span class="subs-label">Name:</span>
          <span>${r.customer ?? "-"}</span>
        </div>
        <div class="subs-row subs-email">
          <span class="subs-label">Email:</span>
          <span>${r.email ?? "-"}</span>
        </div>
        <div class="subs-row subs-dates">
          <div class="subs-purchased">
            <span class="subs-label">Purchased:</span>
            <span>${fmtDate(r.purchased_date)}</span>
          </div>
          <div class="subs-expire">
            <span class="subs-label">Exprie:</span>
            <span>${fmtDate(r.expiry_ymd)}</span>
          </div>
        </div>
        <div class="subs-row subs-dates">
          <div class="subs-purchased">
            <span class="subs-label">Renew at:</span>
            <span>${fmtDate(r.next_due)}</span>
          </div>
          <div class="subs-expire">
            <span class="subs-label">Day Left: </span>
            <span style="font-size: 0.9rem;">${leftLabel(r.left)}</span>
          </div>
        </div>
      `;
      frag.appendChild(card);
    });
    wrap.appendChild(frag);
  }

  // ------------------------------ Orchestration ------------------------------
  async function loadAndRender() {
    const tExpire = qs("expire_soon");
    const tRenew = qs("need_renew");

    setLoading(tExpire);
    setLoading(tRenew);

    try {
      const res = await fetch(API_URL, {
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => ({ success: false }));

      if (
        !res.ok ||
        !json ||
        json.success !== true ||
        !Array.isArray(json.data)
      ) {
        throw new Error((json && json.error) || `HTTP ${res.status}`);
      }

      const rows = json.data;

      // desktop
      renderExpireSoonDesktop(rows);
      renderNeedRenewDesktop(rows);

      // mobile
      renderExpireSoonMobile(rows);
      renderNeedRenewMobile(rows);
    } catch (err) {
      console.error("Load failed:", err);

      if (tExpire) {
        tExpire.innerHTML = "";
        tExpire.appendChild(placeholderRow("Failed to load expiring items."));
      }
      if (tRenew) {
        tRenew.innerHTML = "";
        tRenew.appendChild(placeholderRow("Failed to load renewals."));
      }

      setMobilePlaceholder(
        qs("expired-item"),
        "Failed to load expiring items."
      );
      setMobilePlaceholder(qs("renewal-item"), "Failed to load renewals.");
    }
  }

  document.addEventListener("DOMContentLoaded", loadAndRender);
})();
