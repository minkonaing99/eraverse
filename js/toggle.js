document.addEventListener("DOMContentLoaded", function () {
  const userSettingBtn = document.getElementById("userSettingBtn");
  const userSettingSection = document.getElementById("user_setting");

  const addProductBtn = document.getElementById("addProductBtn");
  const addProductSection = document.getElementById("addProductForm");

  // start hidden
  userSettingSection.style.display = "none";
  addProductSection.style.display = "none";

  // store default values when page loads
  const defaultValues = new WeakMap();
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    if (el.type === "checkbox" || el.type === "radio") {
      defaultValues.set(el, el.checked);
    } else {
      defaultValues.set(el, el.value);
    }
  });

  // util: clear only if value is not the default
  function clearFormInputs(section) {
    section.querySelectorAll("input, select, textarea").forEach((el) => {
      const defaultVal = defaultValues.get(el);
      if (el.type === "checkbox" || el.type === "radio") {
        el.checked = defaultVal;
      } else if (el.tagName === "SELECT") {
        el.value = defaultVal;
      } else {
        el.value = defaultVal;
      }
      el.blur();
    });
  }

  // util: show exactly one section, hide the rest
  function showOnly(target, others) {
    const isVisible = target.style.display !== "none";

    if (isVisible) {
      target.style.display = "none";
      clearFormInputs(target);
      return;
    }

    clearFormInputs(target);
    target.style.display = "block";

    others.forEach((sec) => {
      if (sec && sec !== target) {
        sec.style.display = "none";
        clearFormInputs(sec);
      }
    });
  }

  // wire up buttons
  userSettingBtn.addEventListener("click", function (e) {
    e.preventDefault();
    showOnly(userSettingSection, [addProductSection]);
  });

  addProductBtn.addEventListener("click", function (e) {
    e.preventDefault();
    showOnly(addProductSection, [userSettingSection]);
  });
});
