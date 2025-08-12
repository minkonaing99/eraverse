document
  .getElementById("downloadCsv")
  ?.addEventListener("click", async function () {
    const btn = this;
    btn.disabled = true;
    try {
      const resp = await fetch("api/sales_export_csv.php", {
        headers: { Accept: "text/csv" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_export_${new Date()
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
