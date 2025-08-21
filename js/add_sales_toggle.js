"use strict";

/* -----------------------------
   Add Sales Button Toggle for Retail and Wholesale
   This file handles the single "Add Sales" button that shows
   the appropriate form based on which tab is active
----------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Get the button and form sections
  const addSaleBtn = document.getElementById("addSaleBtn");
  const addSalesSection = document.getElementById("add_sales");
  const addWsSalesSection = document.getElementById("add_ws_sales");

  // Get the tab buttons to check which is active
  const retailBtn = document.getElementById("retail_page");
  const wholesaleBtn = document.getElementById("wholesale_page");

  // Initialize form visibility - ensure they start hidden
  if (addSalesSection) addSalesSection.style.display = "none";
  if (addWsSalesSection) addWsSalesSection.style.display = "none";

  if (addSaleBtn) {
    addSaleBtn.addEventListener("click", () => {
      // Check which page is currently active
      const isRetailActive =
        retailBtn && retailBtn.classList.contains("btn-active");

      if (isRetailActive) {
        // Toggle retail form
        if (addSalesSection) {
          const currentDisplay = addSalesSection.style.display;
          if (currentDisplay === "none" || currentDisplay === "") {
            addSalesSection.style.display = "block";
          } else {
            addSalesSection.style.display = "none";
          }
        }
        // Hide wholesale form
        if (addWsSalesSection) {
          addWsSalesSection.style.display = "none";
        }
      } else {
        // Toggle wholesale form
        if (addWsSalesSection) {
          const currentDisplay = addWsSalesSection.style.display;
          if (currentDisplay === "none" || currentDisplay === "") {
            addWsSalesSection.style.display = "block";
          } else {
            addWsSalesSection.style.display = "none";
          }
        }
        // Hide retail form
        if (addSalesSection) {
          addSalesSection.style.display = "none";
        }
      }
    });
  }

  // Also handle form hiding when switching tabs
  // This ensures forms are hidden when switching between retail/wholesale
  if (retailBtn) {
    retailBtn.addEventListener("click", () => {
      // Hide any open forms when switching to retail
      if (addSalesSection) addSalesSection.style.display = "none";
      if (addWsSalesSection) addWsSalesSection.style.display = "none";
    });
  }

  if (wholesaleBtn) {
    wholesaleBtn.addEventListener("click", () => {
      // Hide any open forms when switching to wholesale
      if (addSalesSection) addSalesSection.style.display = "none";
      if (addWsSalesSection) addWsSalesSection.style.display = "none";
    });
  }

  // Functions to hide forms after successful submission
  // These can be called from other JavaScript files
  window.hideRetailForm = () => {
    if (addSalesSection) addSalesSection.style.display = "none";
  };

  window.hideWholesaleForm = () => {
    if (addWsSalesSection) addWsSalesSection.style.display = "none";
  };
});

const retailBtn = document.getElementById("retail_page");
const wholesaleBtn = document.getElementById("wholesale_page");

// all content sections with these classes
const retailSections = document.querySelectorAll(".retail_page");
const wholesaleSections = document.querySelectorAll(".wholesale_page");

function showPage(page) {
  if (page === "retail") {
    retailBtn.classList.add("btn-active");
    retailBtn.classList.remove("btn-inactive");
    wholesaleBtn.classList.add("btn-inactive");
    wholesaleBtn.classList.remove("btn-active");

    // show retail, hide wholesale
    retailSections.forEach((el) => (el.style.display = "block"));
    wholesaleSections.forEach((el) => (el.style.display = "none"));

    // Hide any open forms when switching pages
    const addSalesSection = document.getElementById("add_sales");
    const addWsSalesSection = document.getElementById("add_ws_sales");
    if (addSalesSection) addSalesSection.style.display = "none";
    if (addWsSalesSection) addWsSalesSection.style.display = "none";
  } else {
    wholesaleBtn.classList.add("btn-active");
    wholesaleBtn.classList.remove("btn-inactive");
    retailBtn.classList.add("btn-inactive");
    retailBtn.classList.remove("btn-active");

    // show wholesale, hide retail
    wholesaleSections.forEach((el) => (el.style.display = "block"));
    retailSections.forEach((el) => (el.style.display = "none"));

    // Hide any open forms when switching pages
    const addSalesSection = document.getElementById("add_sales");
    const addWsSalesSection = document.getElementById("add_ws_sales");
    if (addSalesSection) addSalesSection.style.display = "none";
    if (addWsSalesSection) addWsSalesSection.style.display = "none";
  }
}

// attach events
retailBtn.addEventListener("click", () => showPage("retail"));
wholesaleBtn.addEventListener("click", () => showPage("wholesale"));

// default load: show retail
showPage("retail");
