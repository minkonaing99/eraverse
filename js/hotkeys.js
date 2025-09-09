/**
 * Hotkeys System for Sales Overview Page
 * Handles keyboard shortcuts for sales form actions
 *
 * Available Shortcuts:
 * - 'A' key: Open Add Sales form (Sales Overview page only)
 *
 * Hotkeys are automatically disabled when:
 * - Any input, select, or textarea is focused
 * - Modifier keys (Ctrl, Alt, Shift, Cmd) are pressed
 * - Modal dialogs are open
 */

(function () {
  "use strict";

  // Configuration
  const HOTKEYS = {
    ADD_SALES: "a",
  };

  // Track if hotkeys are enabled (can be disabled during form interactions)
  let hotkeysEnabled = true;

  /**
   * Check if the current page is sales overview
   */
  function isSalesOverviewPage() {
    return (
      window.location.pathname.includes("sales_overview.php") ||
      document.querySelector("#add_sales, #add_ws_sales") !== null
    );
  }

  /**
   * Check if any input, select, or textarea element is currently focused
   */
  function isFormElementFocused() {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const formElements = ["INPUT", "SELECT", "TEXTAREA", "BUTTON"];
    return (
      formElements.includes(activeElement.tagName) ||
      activeElement.contentEditable === "true" ||
      activeElement.isContentEditable
    );
  }

  /**
   * Check if any modal or overlay is open
   */
  function isModalOpen() {
    // Check for common modal indicators
    const modals = document.querySelectorAll(
      '.modal, .overlay, .popup, [role="dialog"]'
    );
    return Array.from(modals).some(
      (modal) =>
        modal.style.display !== "none" &&
        modal.style.visibility !== "hidden" &&
        !modal.classList.contains("hidden")
    );
  }

  /**
   * Get the currently active tab (retail or wholesale)
   */
  function getActiveTab() {
    const retailBtn = document.getElementById("retail_page");
    const wholesaleBtn = document.getElementById("wholesale_page");

    if (retailBtn && retailBtn.classList.contains("btn-active")) {
      return "retail";
    } else if (wholesaleBtn && wholesaleBtn.classList.contains("btn-active")) {
      return "wholesale";
    }

    return "retail"; // default
  }

  /**
   * Open the add sales form based on active tab
   */
  function openAddSalesForm() {
    const activeTab = getActiveTab();
    const addSalesSection = document.getElementById("add_sales");
    const addWsSalesSection = document.getElementById("add_ws_sales");
    const addSaleBtn = document.getElementById("addSaleBtn");

    if (activeTab === "retail" && addSalesSection) {
      // Show retail form
      addSalesSection.style.display = "block";
      if (addWsSalesSection) addWsSalesSection.style.display = "none";

      // Focus on the first input field
      const firstInput = addSalesSection.querySelector("input, select");
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    } else if (activeTab === "wholesale" && addWsSalesSection) {
      // Show wholesale form
      addWsSalesSection.style.display = "block";
      if (addSalesSection) addSalesSection.style.display = "none";

      // Focus on the first input field
      const firstInput = addWsSalesSection.querySelector("input, select");
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }

    // Update button state if it exists
    if (addSaleBtn) {
      addSaleBtn.classList.add("active");
    }
  }

  /**
   * Close any open add sales forms
   */
  function closeAddSalesForm() {
    const addSalesSection = document.getElementById("add_sales");
    const addWsSalesSection = document.getElementById("add_ws_sales");
    const addSaleBtn = document.getElementById("addSaleBtn");

    if (addSalesSection) addSalesSection.style.display = "none";
    if (addWsSalesSection) addWsSalesSection.style.display = "none";

    if (addSaleBtn) {
      addSaleBtn.classList.remove("active");
    }
  }

  /**
   * Handle keydown events
   */
  function handleKeydown(event) {
    // Don't handle hotkeys if they're disabled or if form elements are focused
    if (!hotkeysEnabled || isFormElementFocused() || isModalOpen()) {
      return;
    }

    // Don't handle hotkeys if modifier keys are pressed (Ctrl, Alt, Shift, Meta)
    if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
      return;
    }

    const key = event.key.toLowerCase();

    // Handle 'a' key for add sales
    if (key === HOTKEYS.ADD_SALES && isSalesOverviewPage()) {
      event.preventDefault();
      openAddSalesForm();
      return;
    }
  }

  /**
   * Temporarily disable hotkeys (useful during form interactions)
   */
  function disableHotkeys() {
    hotkeysEnabled = false;
  }

  /**
   * Re-enable hotkeys
   */
  function enableHotkeys() {
    hotkeysEnabled = true;
  }

  /**
   * Add a subtle visual indicator that hotkeys are available
   */
  function addHotkeyIndicator() {
    // Only add indicator on sales overview page
    if (!isSalesOverviewPage()) {
      return;
    }

    // Create a small help indicator
    const indicator = document.createElement("div");
    indicator.id = "hotkey-indicator";
    indicator.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.8);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-family: monospace;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.3s ease;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.2);
      " title="Click to hide">
        Press A to add sales
      </div>
    `;

    // Add click to hide functionality
    indicator.addEventListener("click", () => {
      indicator.style.opacity = "0";
      setTimeout(() => indicator.remove(), 300);
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.opacity = "0";
        setTimeout(() => indicator.remove(), 300);
      }
    }, 5000);

    document.body.appendChild(indicator);
  }

  /**
   * Initialize the hotkeys system
   */
  function init() {
    // Add event listener for keydown events
    document.addEventListener("keydown", handleKeydown, true);
    console.log("Hotkeys event listener attached");

    // Disable hotkeys when form elements are focused
    document.addEventListener("focusin", (event) => {
      if (isFormElementFocused()) {
        disableHotkeys();
      }
    });

    // Re-enable hotkeys when focus leaves form elements
    document.addEventListener("focusout", (event) => {
      // Small delay to allow for proper focus handling
      setTimeout(() => {
        if (!isFormElementFocused()) {
          enableHotkeys();
        }
      }, 100);
    });

    // Handle form submissions to re-enable hotkeys
    document.addEventListener("submit", (event) => {
      setTimeout(() => {
        enableHotkeys();
      }, 500);
    });

    // Add visual indicator for hotkeys (optional)
    addHotkeyIndicator();

    console.log("Hotkeys system initialized");
  }

  // Public API
  window.HotkeysSystem = {
    openAddSalesForm,
    closeAddSalesForm,
    disableHotkeys,
    enableHotkeys,
    isEnabled: () => hotkeysEnabled,
  };

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
