document
  .getElementById("downloadCsv")
  ?.addEventListener("click", async function () {
    const btn = this;
    btn.disabled = true;
    try {
      // Check which page is currently active
      const retailBtn = document.getElementById("retail_page");
      const isRetailActive =
        retailBtn && retailBtn.classList.contains("btn-active");

      const apiUrl = isRetailActive
        ? "api/sales_export_csv.php"
        : "api/ws_sales_export_csv.php";
      const filename = isRetailActive ? "retail_sales" : "wholesale_sales";

      const resp = await fetch(apiUrl, {
        headers: { Accept: "text/csv" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}_export_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[-:T]/g, "")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });
