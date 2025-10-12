const API_BASE = window.location.origin;
let instances = [];

// Check authentication
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login';
}

// Set user name
const userName = localStorage.getItem('user_name');
if (userName) {
    document.getElementById('userName').textContent = userName;
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    window.location.href = '/login';
});

// Fetch instances
async function loadInstances() {
    const container = document.getElementById('instancesContainer');
    const emptyState = document.getElementById('emptyState');
    
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/user/instances`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load instances');
        }
        
        const data = await response.json();
        instances = data.instances;
        
        if (instances.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            renderInstances();
        }
        
    } catch (error) {
        container.innerHTML = `
            <div class="error-message show">
                Failed to load instances: ${error.message}
            </div>
        `;
    }
}

function renderInstances() {
    const container = document.getElementById('instancesContainer');
    
    container.innerHTML = instances.map(instance => `
        <div class="instance-card">
            <div class="instance-header">
                <div>
                    <div class="instance-name">${instance.name}</div>
                    <div class="instance-region">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        ${instance.server_region}
                    </div>
                </div>
                <span class="status-badge status-${instance.status}">
                    ${instance.status}
                </span>
            </div>
            
            <div class="instance-details">
                <div class="detail-row">
                    <span class="detail-label">Local Port</span>
                    <span class="detail-value">${instance.local_port}</span>
                </div>
                ${instance.status === 'active' && instance.public_url ? `
                    <div class="detail-row">
                        <span class="detail-label">Public URL</span>
                        <span class="detail-value public-url">${instance.public_url}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="instance-actions">
                ${instance.status === 'online' ? `
                    <button class="btn btn-view btn-small" onclick="viewTunnel('${instance.id}', '${instance.name}', ${instance.local_port})">
                        View
                    </button>
                    <button class="btn btn-danger btn-small" onclick="disconnectInstance('${instance.id}')">
                        Disconnect
                    </button>
                ` : `
                    <button class="btn btn-success btn-small" onclick="connectInstance('${instance.id}')" disabled>
                        ${instance.status === 'offline' ? 'Offline' : 'Waiting for client...'}
                    </button>
                `}
            </div>
        </div>
    `).join('');
}

async function connectInstance(instanceId) {
    try {
        const response = await fetch(`${API_BASE}/api/user/instances/${instanceId}/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to connect instance');
        }
        
        const data = await response.json();
        
        // Show connection info
        alert(`Instance connected!\n\nTunnel Token: ${data.tunnel_token}\nServer: ${data.server_host}\nRemote Port: ${data.remote_port}\n\nRun this command:\nbore ${data.local_port} --to ${data.server_host} --secret ${data.tunnel_token}`);
        
        // Reload instances
        await loadInstances();
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function disconnectInstance(instanceId) {
    try {
        const response = await fetch(`${API_BASE}/api/user/instances/${instanceId}/disconnect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to disconnect instance');
        }
        
        // Reload instances
        await loadInstances();
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// View tunnel - navigate to dedicated viewer page
function viewTunnel(instanceId, instanceName, localPort) {
    // Navigate to the viewer page with query parameters
    window.location.href = `/viewer?id=${instanceId}&name=${encodeURIComponent(instanceName)}&port=${localPort}`;
}

// Make function global
window.viewTunnel = viewTunnel;

// Load instances on page load
loadInstances();

// Auto-refresh every 10 seconds
setInterval(loadInstances, 10000);
