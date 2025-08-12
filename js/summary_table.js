(() => {
  const API_URL = "api/sales_minimal.php";

  // ---------- UTC date helpers ----------
  const toUTC = (ymd) => {
    if (!ymd) return null;
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return null;
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
  const msPerDay = 86400000;
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

  // Format with UTC to avoid TZ drift
  const fmtDate = (ymdStr) => {
    const dt = toUTC(ymdStr);
    if (!dt) return "-";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(dt);
  };
  const leftLabel = (n) => (n <= 0 ? "Today" : n === 1 ? "1 day" : `${n} days`);

  const placeholderRow = (text, colspan = 7) => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "era-muted";
    td.colSpan = colspan;
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  };

  // ---------- EXPIRE SOON (final expiry in <=2 days) ----------
  function renderExpireSoon(rows) {
    const tbody = document.getElementById("expire_soon");
    if (!tbody) return;
    tbody.innerHTML = "";

    const soon = (rows || [])
      .map((r) => {
        const exp = toUTC(r.expired_date);
        return exp ? { ...r, _days: daysBetween(exp, todayUTC) } : null;
      })
      .filter(Boolean)
      .filter((r) => r._days >= 0 && r._days < 3)
      .sort(
        (a, b) =>
          a._days - b._days ||
          String(a.expired_date).localeCompare(String(b.expired_date))
      );

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

  // ---------- helpers for NEED RENEW ----------
  // Next due on/after base: purchase + k*renewMonths (k >= 1)
  function nextDueFromAnchor(purchaseYMD, renewMonths, base = todayUTC) {
    const p = toUTC(purchaseYMD);
    if (!p || !Number.isInteger(renewMonths) || renewMonths <= 0) return null;
    // start at the first renewal (k=1)
    let due = addMonthsUTC(p, renewMonths);
    // advance by renewMonths until we are on/after "base"
    while (due < base) {
      due = addMonthsUTC(due, renewMonths);
    }
    return due;
  }

  // Compute expiry if not provided: purchased + duration months
  function computeExpiryUTC(purchasedYMD, duration) {
    const p = toUTC(purchasedYMD);
    if (!p || !Number.isInteger(duration) || duration < 1) return null;
    return addMonthsUTC(p, duration);
  }

  // ---------- NEED RENEW (interval = renew months) ----------
  function renderNeedRenew(rows) {
    const tbody = document.getElementById("need_renew");
    if (!tbody) return;
    tbody.innerHTML = "";

    const out = [];

    (rows || []).forEach((r) => {
      const renew = Number.isFinite(+r.renew) ? parseInt(r.renew, 10) : 0;
      if (!Number.isInteger(renew) || renew <= 0) return; // ignore 0

      const duration = Number.isFinite(+r.duration)
        ? parseInt(r.duration, 10)
        : null;
      if (Number.isInteger(duration) && renew >= duration) return; // ignore when renew >= duration

      const purUTC = toUTC(r.purchased_date);
      if (!purUTC) return;

      // Determine expiry
      const expUTC =
        toUTC(r.expired_date) || computeExpiryUTC(r.purchased_date, duration);

      // Skip if in "expire soon"
      if (expUTC) {
        const dToExp = daysBetween(expUTC, todayUTC);
        if (dToExp >= 0 && dToExp < 3) return;
      }

      // Next due (purchase + k*renew) on/after today
      const due = nextDueFromAnchor(r.purchased_date, renew, todayUTC);
      if (!due) return;

      // Must be within the subscription window and not in the final "renew" window
      if (expUTC) {
        // last day to show a renewal is expiry - renew months
        const lastCutoff = addMonthsUTC(expUTC, -renew);
        if (due > lastCutoff) return;
      }

      // Also ensure due is not before purchase (paranoia)
      if (due < purUTC) return;

      const left = daysBetween(due, todayUTC);
      if (left >= 0 && left < 3) {
        out.push({
          sale_product: r.sale_product,
          customer: r.customer,
          email: r.email,
          purchased_date: r.purchased_date,
          next_due: ymd(due),
          left,
        });
      }
    });

    if (out.length === 0) {
      tbody.appendChild(placeholderRow("No renewals due within 3 days."));
      return;
    }

    out.sort((a, b) => a.left - b.left || a.next_due.localeCompare(b.next_due));

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
        <td style="text-align: right;">${leftLabel(r.left)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  // ---------- Fetch once and render both ----------
  async function loadAndRender() {
    // Expire soon table
    const t1 = document.getElementById("expire_soon");
    if (t1) {
      t1.innerHTML = "";
      t1.appendChild(placeholderRow("Loading…"));
    }
    // Need renew table
    const t2 = document.getElementById("need_renew");
    if (t2) {
      t2.innerHTML = "";
      t2.appendChild(placeholderRow("Loading…"));
    }

    try {
      const res = await fetch(API_URL, {
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !json.success)
        throw new Error(json.error || `HTTP ${res.status}`);

      renderExpireSoon(json.data || []);
      renderNeedRenew(json.data || []);
    } catch (err) {
      console.error("Load failed:", err);
      if (t1) {
        t1.innerHTML = "";
        t1.appendChild(placeholderRow("Failed to load expiring items."));
      }
      if (t2) {
        t2.innerHTML = "";
        t2.appendChild(placeholderRow("Failed to load renewals."));
      }
    }
  }

  document.addEventListener("DOMContentLoaded", loadAndRender);
})();
