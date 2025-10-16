"use strict";
(() => {
  // frontend-src/viewer.ts
  var urlParams = new URLSearchParams(window.location.search);
  var instanceId = urlParams.get("id");
  var instanceName = urlParams.get("name");
  var localPort = urlParams.get("port");
  if (!instanceId || !localPort) {
    window.location.href = "/dashboard";
  }
  var tunnelUrl = `http://localhost:${localPort}`;
  document.getElementById("tunnelName").textContent = instanceName || "Tunnel Instance";
  document.getElementById("tunnelUrl").textContent = tunnelUrl;
  var iframe = document.getElementById("tunnelFrame");
  var loading = document.getElementById("loading");
  iframe.onload = function() {
    loading.style.display = "none";
    iframe.style.display = "block";
  };
  iframe.src = tunnelUrl;
  function reloadTunnel() {
    loading.style.display = "block";
    iframe.style.display = "none";
    iframe.src = iframe.src;
  }
  function openInNewWindow() {
    window.open(tunnelUrl, "_blank", "width=1200,height=800");
  }
  window.reloadTunnel = reloadTunnel;
  window.openInNewWindow = openInNewWindow;
})();
//# sourceMappingURL=viewer.js.map
