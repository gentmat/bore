"use strict";
(() => {
  // frontend-src/dashboard.ts
  var API_BASE = window.location.origin;
  var instances = [];
  var instanceElements = /* @__PURE__ */ new Map();
  var isFirstLoad = true;
  var token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
  }
  var userName = localStorage.getItem("user_name");
  if (userName) {
    document.getElementById("userName").textContent = userName;
  }
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    window.location.href = "/login";
  });
  async function loadInstances() {
    const container = document.getElementById("instancesContainer");
    const emptyState = document.getElementById("emptyState");
    if (isFirstLoad) {
      container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    }
    try {
      const response = await fetch(`${API_BASE}/api/user/instances`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to load instances");
      }
      const data = await response.json();
      instances = data.instances;
      if (isFirstLoad) {
        container.innerHTML = "";
      }
      updateInstanceCards(instances, container, emptyState);
      isFirstLoad = false;
    } catch (error) {
      container.innerHTML = `
            <div class="error-message show">
                Failed to load instances: ${error.message}
            </div>
        `;
      emptyState.style.display = "none";
    }
  }
  function updateInstanceCards(newInstances, container, emptyState) {
    const activeIds = /* @__PURE__ */ new Set();
    newInstances.forEach((instance) => {
      activeIds.add(instance.id);
      let card = instanceElements.get(instance.id);
      if (!card) {
        card = createInstanceCard(instance);
        instanceElements.set(instance.id, card);
        container.appendChild(card);
      } else {
        updateInstanceCard(card, instance);
      }
    });
    instanceElements.forEach((card, id) => {
      if (!activeIds.has(id)) {
        card.remove();
        instanceElements.delete(id);
      }
    });
    if (instanceElements.size === 0) {
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
    }
  }
  function createInstanceCard(instance) {
    const card = document.createElement("div");
    card.className = "instance-card";
    card.dataset.instanceId = instance.id;
    card.innerHTML = buildInstanceCardInnerHTML(instance);
    bindCardActions(card, instance);
    return card;
  }
  function updateInstanceCard(card, instance) {
    const nameEl = card.querySelector('[data-field="name"]');
    if (nameEl) {
      nameEl.textContent = instance.name;
    }
    const regionEl = card.querySelector('[data-field="region"]');
    if (regionEl) {
      regionEl.textContent = instance.server_region;
    }
    const statusEl = card.querySelector('[data-field="status"]');
    if (statusEl) {
      statusEl.textContent = instance.status;
      statusEl.className = `status-badge status-${instance.status}`;
    }
    const localPortEl = card.querySelector('[data-field="local_port"]');
    if (localPortEl) {
      localPortEl.textContent = instance.local_port.toString();
    }
    const publicUrlRow = card.querySelector('[data-field="public_url_row"]');
    const publicUrlEl = card.querySelector('[data-field="public_url"]');
    if (publicUrlRow && publicUrlEl) {
      if (instance.status === "active" && instance.public_url) {
        publicUrlEl.textContent = instance.public_url;
        publicUrlRow.style.display = "";
      } else {
        publicUrlEl.textContent = "";
        publicUrlRow.style.display = "none";
      }
    }
    const actionsContainer = card.querySelector(".instance-actions");
    if (actionsContainer) {
      actionsContainer.innerHTML = getActionsTemplate(instance);
      bindCardActions(card, instance);
    }
  }
  function buildInstanceCardInnerHTML(instance) {
    const publicUrlVisible = instance.status === "active" && instance.public_url;
    return `
        <div class="instance-header">
            <div>
                <div class="instance-name" data-field="name">${instance.name}</div>
                <div class="instance-region">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span class="instance-region-text" data-field="region">${instance.server_region}</span>
                </div>
            </div>
            <span class="status-badge status-${instance.status}" data-field="status">
                ${instance.status}
            </span>
        </div>
        <div class="instance-details">
            <div class="detail-row">
                <span class="detail-label">Local Port</span>
                <span class="detail-value" data-field="local_port">${instance.local_port}</span>
            </div>
            <div class="detail-row" data-field="public_url_row" style="${publicUrlVisible ? "" : "display: none;"}">
                <span class="detail-label">Public URL</span>
                <span class="detail-value public-url" data-field="public_url">${publicUrlVisible ? instance.public_url : ""}</span>
            </div>
        </div>
        <div class="instance-actions">
            ${getActionsTemplate(instance)}
        </div>
    `;
  }
  function bindCardActions(card, instance) {
    const viewButton = card.querySelector('[data-action="view"]');
    if (viewButton) {
      viewButton.addEventListener("click", () => viewTunnel(instance.id, instance.name, instance.local_port));
    }
    const disconnectButton = card.querySelector('[data-action="disconnect"]');
    if (disconnectButton) {
      disconnectButton.addEventListener("click", () => disconnectInstance(instance.id));
    }
    const connectButton = card.querySelector('[data-action="connect"]');
    if (connectButton && !connectButton.disabled) {
      connectButton.addEventListener("click", () => connectInstance(instance.id));
    }
  }
  function getActionsTemplate(instance) {
    if (instance.status === "online") {
      return `
            <button class="btn btn-view btn-small" data-action="view">View</button>
            <button class="btn btn-danger btn-small" data-action="disconnect">Disconnect</button>
        `;
    }
    const label = instance.status === "offline" ? "Offline" : "Waiting for client...";
    return `
        <button class="btn btn-success btn-small" data-action="connect" disabled>${label}</button>
    `;
  }
  async function connectInstance(instanceId) {
    try {
      const response = await fetch(`${API_BASE}/api/user/instances/${instanceId}/connect`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to connect instance");
      }
      const data = await response.json();
      alert(`Instance connected!

Tunnel Token: ${data.tunnel_token}
Server: ${data.server_host}
Remote Port: ${data.remote_port}

Run this command:
bore ${data.local_port} --to ${data.server_host} --secret ${data.tunnel_token}`);
      await loadInstances();
    } catch (error) {
      alert("Error: " + error.message);
    }
  }
  async function disconnectInstance(instanceId) {
    try {
      const response = await fetch(`${API_BASE}/api/user/instances/${instanceId}/disconnect`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to disconnect instance");
      }
      await loadInstances();
    } catch (error) {
      alert("Error: " + error.message);
    }
  }
  function viewTunnel(instanceId, instanceName, localPort) {
    window.location.href = `/viewer?id=${instanceId}&name=${encodeURIComponent(instanceName)}&port=${localPort}`;
  }
  window.viewTunnel = viewTunnel;
  loadInstances();
  setInterval(loadInstances, 1e4);
})();
//# sourceMappingURL=dashboard.js.map
