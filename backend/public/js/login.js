"use strict";
(() => {
  // frontend-src/login.ts
  var API_BASE = window.location.origin;
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoader = submitBtn.querySelector(".btn-loader");
    errorMessage.classList.remove("show");
    errorMessage.textContent = "";
    btnText.style.display = "none";
    btnLoader.style.display = "block";
    submitBtn.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }
      const userPayload = data?.user || {};
      const isAdmin = !!userPayload.is_admin;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", userPayload.id || "");
      localStorage.setItem("user_name", userPayload.name || email);
      localStorage.setItem("is_admin", isAdmin ? "true" : "false");
      window.location.href = isAdmin ? "/admin.html" : "/dashboard";
    } catch (error) {
      errorMessage.textContent = error.message || "An error occurred. Please try again.";
      errorMessage.classList.add("show");
      btnText.style.display = "block";
      btnLoader.style.display = "none";
      submitBtn.disabled = false;
    }
  });
  if (localStorage.getItem("token")) {
    const isAdmin = localStorage.getItem("is_admin") === "true";
    window.location.href = isAdmin ? "/admin.html" : "/dashboard";
  }
})();
//# sourceMappingURL=login.js.map
