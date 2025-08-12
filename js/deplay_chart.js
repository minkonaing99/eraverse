/* ================================
   SUMMARY PAGE – CLEAN SCRIPT
   ================================ */

(() => {
  // ---------- Config ----------
  const API_URL = "api/sales_minimal.php"; // returns: sale_id, sale_product, price, profit, purchased_date

  // A deep, high-contrast dark palette (not only red).
  const DARK_PALETTE = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#0ea5e9",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#ec4899",
    "#f43f5e",
    "#dc2626",
    "#9333ea",
    "#2563eb",
    "#059669",
    "#d97706",
  ];

  // ---------- Utils ----------
  const todayYMD = () => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  };

  const thisMonthKey = () => todayYMD().slice(0, 7); // "YYYY-MM"

  const fmtKs = (n) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      Math.round(Number(n) || 0)
    ) + " Ks";

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const ymdLocal = (d) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, "0"),
      String(dt.getDate()).padStart(2, "0"),
    ].join("-");
  };

  const lastNDates = (n = 30) => {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(d);
    }
    return out;
  };

  // Small count-up for KPIs
  const animateValue = (el, to, duration = 600) => {
    const start = performance.now();
    const step = (ts) => {
      const p = Math.min(1, (ts - start) / duration);
      el.textContent = fmtKs(to * p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // ---------- Data ----------
  async function fetchRows() {
    const r = await fetch(API_URL, { headers: { Accept: "application/json" } });
    // If server returned PHP error HTML, .json() will throw – surface it clearly
    const json = await r
      .json()
      .catch(() => ({ success: false, error: "Invalid JSON" }));
    if (!r.ok || !json.success)
      throw new Error(json.error || `HTTP ${r.status}`);
    return Array.isArray(json.data) ? json.data : [];
  }

  // ---------- KPIs ----------
  function updateKPIs(rows) {
    const map = {};
    document.querySelectorAll(".kpi-card").forEach((card) => {
      const label = card.querySelector(".kpi-label")?.textContent?.trim();
      const valueEl = card.querySelector(".kpi-value");
      if (label && valueEl) map[label] = valueEl;
    });

    const today = todayYMD();
    const month = thisMonthKey();

    let dailySales = 0,
      dailyProfit = 0,
      monthlySales = 0,
      monthlyProfit = 0;
    for (const r of rows) {
      const d = String(r.purchased_date || "");
      const price = Number(r.price) || 0;
      const profit = Number(r.profit) || 0;
      if (d === today) {
        dailySales += price;
        dailyProfit += profit;
      }
      if (d.slice(0, 7) === month) {
        monthlySales += price;
        monthlyProfit += profit;
      }
    }

    if (map["Daily Sales"]) animateValue(map["Daily Sales"], dailySales);
    if (map["Daily Profits"]) animateValue(map["Daily Profits"], dailyProfit);
    if (map["Monthly Sales"]) animateValue(map["Monthly Sales"], monthlySales);
    if (map["Monthly Profits"])
      animateValue(map["Monthly Profits"], monthlyProfit);
  }

  // ---------- Charts: shared ----------
  function destroyChartOn(canvas) {
    if (canvas && canvas._chart) {
      canvas._chart.destroy();
      canvas._chart = null;
    }
  }

  // Random dark palette (new per chart)
  const pickColors = (n) => shuffle(DARK_PALETTE).slice(0, Math.max(1, n));

  // ---------- Daily Pies ----------
  function buildPie(
    canvas,
    { title, labels, values, format = (v) => String(v) }
  ) {
    if (!canvas) return;
    destroyChartOn(canvas);

    const colors = pickColors(labels.length);
    canvas._chart = new Chart(canvas, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: "rgba(255,255,255,0.35)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 16, right: 16, top: 8, bottom: 8 } },
        plugins: {
          title: {
            display: true,
            text: title,
            position: "top",
            color: "#fff",
            font: { size: 16, weight: "bold" },
            padding: { top: 6, bottom: 10 },
          },
          legend: {
            position: "bottom",
            labels: {
              color: "#fff",
              padding: 12,
              boxWidth: 14,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: "rgba(20,20,24,.92)",
            titleColor: "#fff",
            bodyColor: "#fff",
            callbacks: {
              label: (ctx) => ` ${ctx.label ?? ""}: ${format(ctx.raw ?? 0)}`,
            },
          },
        },
      },
    });
  }

  function buildDailyPies(rows) {
    const today = todayYMD();

    // group today's rows by product
    const agg = new Map(); // product -> {sales, profit, count}
    for (const row of rows) {
      if (String(row.purchased_date) !== today) continue;
      const key = row.sale_product || "(Unknown)";
      if (!agg.has(key)) agg.set(key, { sales: 0, profit: 0, count: 0 });
      const o = agg.get(key);
      o.sales += Number(row.price) || 0;
      o.profit += Number(row.profit) || 0;
      o.count += 1;
    }

    const labels = Array.from(agg.keys());
    const sales = labels.map((k) => agg.get(k).sales);
    const profits = labels.map((k) => agg.get(k).profit);
    const counts = labels.map((k) => agg.get(k).count);

    const nonEmpty = labels.length > 0;
    const safeLabels = nonEmpty ? labels : ["No data"];
    const salesVals = nonEmpty ? sales : [1];
    const profitVals = nonEmpty ? profits : [1];
    const countVals = nonEmpty ? counts : [1];

    buildPie(document.getElementById("chartDailySales"), {
      title: "Today's Sales by Product",
      labels: safeLabels,
      values: salesVals,
      format: fmtKs,
    });

    buildPie(document.getElementById("chartDailyProfit"), {
      title: "Today's Profit by Product",
      labels: safeLabels,
      values: profitVals,
      format: fmtKs,
    });

    buildPie(document.getElementById("chartDailyCount"), {
      title: "Today's Orders (Count) by Product",
      labels: safeLabels,
      values: countVals,
      format: (v) => String(v),
    });
  }

  // ---------- 30-day Line (sales + profit, legend bottom, max dots) ----------
  function drawSalesProfitLine(labels, sales, profits) {
    const canvas = document.getElementById("salesProfitLine");
    if (!canvas) return;
    destroyChartOn(canvas);
    const ctx = canvas.getContext("2d");

    const maxIndex = (arr) => {
      let idx = 0,
        max = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        const v = Number(arr[i]) || 0;
        if (v > max) {
          max = v;
          idx = i;
        }
      }
      return idx;
    };
    const salesMaxI = maxIndex(sales);
    const profitMaxI = maxIndex(profits);

    canvas._chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sales (Ks)",
            data: sales,
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96,165,250,.15)",
            tension: 0.3,
            fill: true,
            pointRadius: (c) => (c.dataIndex === salesMaxI ? 5 : 0),
            pointHoverRadius: (c) => (c.dataIndex === salesMaxI ? 7 : 4),
            pointBackgroundColor: "#60a5fa",
            pointBorderColor: "#60a5fa",
            hitRadius: 8,
          },
          {
            label: "Profit (Ks)",
            data: profits,
            borderColor: "#34d399",
            backgroundColor: "rgba(52,211,153,.15)",
            tension: 0.3,
            fill: true,
            pointRadius: (c) => (c.dataIndex === profitMaxI ? 5 : 0),
            pointHoverRadius: (c) => (c.dataIndex === profitMaxI ? 7 : 4),
            pointBackgroundColor: "#34d399",
            pointBorderColor: "#34d399",
            hitRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          title: {
            display: true,
            text: "Daily Sales & Profit (Last 30 Days)",
            color: "#fff",
            font: { size: 16, weight: "bold" },
            padding: { top: 6, bottom: 10 },
          },
          legend: {
            position: "bottom",
            labels: { color: "#fff", usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: "rgba(20,20,24,.92)",
            titleColor: "#fff",
            bodyColor: "#fff",
            callbacks: {
              label: (ctx) => ` ${fmtKs(ctx.parsed.y || 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,.10)" },
            ticks: {
              color: "#fff",
              maxRotation: 90,
              minRotation: 90,
              autoSkip: true,
              maxTicksLimit: 15,
            },
            title: { display: true, text: "Date", color: "#fff" },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,.10)" },
            ticks: {
              color: "#fff",
              callback: (v) =>
                v >= 1000
                  ? (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k"
                  : v,
            },
            title: { display: true, text: "Kyat (Ks)", color: "#fff" },
          },
        },
      },
    });
  }

  async function buildLine30(rows) {
    const days = lastNDates(30);
    const daily = new Map(
      days.map((d) => [ymdLocal(d), { sales: 0, profit: 0 }])
    );

    for (const row of rows) {
      const k = String(row.purchased_date || "");
      if (!daily.has(k)) continue;
      const o = daily.get(k);
      o.sales += Number(row.price) || 0;
      o.profit += Number(row.profit) || 0;
    }

    const labels = days.map((d) =>
      new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
      }).format(d)
    );
    const sales = days.map((d) => daily.get(ymdLocal(d)).sales);
    const profits = days.map((d) => daily.get(ymdLocal(d)).profit);

    drawSalesProfitLine(labels, sales, profits);
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const rows = await fetchRows();
      updateKPIs(rows);
      buildDailyPies(rows);
      buildLine30(rows);
    } catch (err) {
      console.error("Summary load failed:", err);

      // KPI fallback
      document
        .querySelectorAll(".kpi-value")
        .forEach((el) => (el.textContent = fmtKs(0)));

      // Chart fallbacks
      const chartIds = [
        "chartDailySales",
        "chartDailyProfit",
        "chartDailyCount",
        "salesProfitLine",
      ];
      chartIds.forEach((id) => {
        const c = document.getElementById(id);
        if (!c) return;
        const wrap = c.parentElement;
        wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#e74a3b">Failed to load chart</div>`;
      });
    }
  });
})();
