/* -----------------------------
   Add User form: validation + submit
----------------------------- */
(() => {
  const form = document.querySelector("#addUserRow form");
  if (!form) return;

  const elUsername = document.getElementById("username");
  const elPassword = document.getElementById("password");
  const elRole = document.getElementById("role");
  const saveBtn = form.querySelector('button[type="submit"]');
  const feedback = document.getElementById("feedback_addUser");

  const setDanger = (el, on) => {
    if (!el) return;
    el.classList.toggle("text-danger", !!on);
    const label = el.id
      ? document.querySelector(`label[for="${el.id}"]`)
      : null;
    if (label) label.classList.toggle("text-danger", !!on);
  };

  const showFeedback = (msg, ok = true) => {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.style.display = "block";
    feedback.style.color = ok ? "white" : "red";
  };

  const clearFeedback = () => {
    if (feedback) feedback.style.display = "none";
  };

  function validatePassword(pw) {
    const errors = [];
    if (pw.length < 10) errors.push("≥10 characters");
    if (!/[A-Z]/.test(pw)) errors.push("an uppercase letter");
    if (!/\d/.test(pw)) errors.push("a number");
    if (!/[^A-Za-z0-9]/.test(pw)) errors.push("a special character");
    return errors;
  }

  function normalizeRole(v) {
    const s = (v || "").toLowerCase().trim();
    if (s === "admin" || s === "staff" || s === "owner") return s;
    // default to staff if "Choose..." or unknown
    return "staff";
  }

  function validate() {
    clearFeedback();
    const u = (elUsername?.value || "").trim();
    const p = elPassword?.value || "";
    const r = normalizeRole(elRole?.value);

    const pwErrors = validatePassword(p);

    setDanger(elUsername, !u || u.length < 3);
    setDanger(elPassword, pwErrors.length > 0);
    // mark role invalid if it's still the disabled "Choose..."
    const invalidRole = !elRole || elRole.selectedIndex === 0 || !r;
    setDanger(elRole, invalidRole);

    if (!u || u.length < 3)
      return { ok: false, msg: "Username must be at least 3 characters." };
    if (pwErrors.length)
      return {
        ok: false,
        msg: "Password must contain " + pwErrors.join(", ") + ".",
      };
    if (invalidRole) return { ok: false, msg: "Please choose a role." };

    return { ok: true, data: { username: u, password: p, role: r } };
  }

  // Live feedback as the user types
  elUsername?.addEventListener("input", validate);
  elPassword?.addEventListener("input", validate);
  elRole?.addEventListener("change", validate);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = validate();
    if (!v.ok) {
      showFeedback(v.msg, false);
      return;
    }

    // Disable button during submit
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add("disableBtn");
    }

    try {
      const resp = await fetch("api/user_create.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(v.data),
      });

      // Safely try to parse JSON (some servers echo HTML on error)
      let json = {};
      try {
        json = await resp.json();
      } catch (_) {}

      if (!resp.ok || !json.success) {
        const msg = json.error || `Request failed (HTTP ${resp.status})`;
        throw new Error(msg);
      }

      // Success UI
      showFeedback("User created", true);

      // Reset form
      form.reset();
      // If your first option is "Choose..." make sure it's selected after reset
      if (elRole && elRole.options.length) elRole.selectedIndex = 0;
      // Clear danger states
      setDanger(elUsername, false);
      setDanger(elPassword, false);
      setDanger(elRole, false);
      if (typeof window.refreshUserDropdown === "function") {
        window.refreshUserDropdown();
      }

      // Hide success message after a moment (optional)
      setTimeout(clearFeedback, 1200);
    } catch (err) {
      showFeedback(err.message || "Failed to create user.", false);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove("disableBtn");
      }
    }
  });
})();

// ---- Delete User UI ----
(function () {
  const form = document.querySelector("#delUserRow form");
  if (!form) return;

  const select = document.getElementById("user");
  const feedback = document.getElementById("feedback_delUser");

  function showMsg(msg, ok = true) {
    if (!feedback) {
      alert(msg);
      return;
    }
    feedback.textContent = msg;
    feedback.style.display = "block";
    feedback.style.color = ok ? "var(--ok, #58d68d)" : "var(--err, #e74c3c)";
    if (ok) setTimeout(() => (feedback.style.display = "none"), 1500);
  }

  async function loadUsersForDelete() {
    // Clear and add placeholder
    select.replaceChildren(new Option("Loading…", "", true, true));
    select.options[0].disabled = true;

    try {
      const res = await fetch("api/user_list_simple.php", {
        headers: { Accept: "application/json" },
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success)
        throw new Error(json.error || `HTTP ${res.status}`);

      const users = Array.isArray(json.data) ? json.data : [];
      select.replaceChildren(new Option("Choose...", "", true, true));
      select.options[0].disabled = true;

      users.forEach((u) => {
        const label = `${u.username} (${u.role})`;
        select.add(new Option(label, String(u.user_id)));
      });
    } catch (err) {
      select.replaceChildren(new Option("Failed to load", "", true, true));
      select.options[0].disabled = true;
      showMsg(`Load users failed: ${err.message}`, false);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = parseInt(select.value, 10);
    if (!id) {
      showMsg("Please choose a user.", false);
      return;
    }

    const chosenText = select.selectedOptions[0]?.textContent || "this user";
    if (!confirm(`Delete ${chosenText}? This cannot be undone.`)) return;

    // Disable UI briefly
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("disableBtn");
    }

    try {
      const res = await fetch("api/user_delete.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success)
        throw new Error(json.error || `HTTP ${res.status}`);

      // Remove the deleted option from the select
      select.remove(select.selectedIndex);
      select.selectedIndex = 0; // back to "Choose..."

      showMsg("User deleted", true);
    } catch (err) {
      showMsg(`Delete failed: ${err.message}`, false);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("disableBtn");
      }
    }
  });

  // Initial load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadUsersForDelete);
  } else {
    loadUsersForDelete();
  }

  // Optional: expose to refresh after creating a user elsewhere
  window.refreshUserDropdown = loadUsersForDelete;
})();
