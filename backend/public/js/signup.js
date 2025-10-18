"use strict";
(() => {
  // frontend-src/signup.ts
  var API_BASE = window.location.origin;
  document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoader = submitBtn.querySelector(".btn-loader");
    errorMessage.classList.remove("show");
    successMessage.classList.remove("show");
    errorMessage.textContent = "";
    successMessage.textContent = "";
    if (password !== confirmPassword) {
      errorMessage.textContent = "Passwords do not match";
      errorMessage.classList.add("show");
      return;
    }
    btnText.style.display = "none";
    btnLoader.style.display = "block";
    submitBtn.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Signup failed");
      }
      successMessage.textContent = "Account created successfully! Redirecting to claim your trial...";
      successMessage.classList.add("show");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("user_email", email);
      setTimeout(() => {
        window.location.href = "/claim-trial";
      }, 1500);
    } catch (error) {
      errorMessage.textContent = error.message || "An error occurred. Please try again.";
      errorMessage.classList.add("show");
      btnText.style.display = "block";
      btnLoader.style.display = "none";
      submitBtn.disabled = false;
    }
  });
  if (localStorage.getItem("token")) {
    const hasPlan = localStorage.getItem("user_plan");
    if (hasPlan) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/claim-trial";
    }
  }
})();
//# sourceMappingURL=signup.js.map
