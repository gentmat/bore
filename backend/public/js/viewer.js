// Get instance details from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const instanceId = urlParams.get('id');
const instanceName = urlParams.get('name');
const localPort = urlParams.get('port');

// Redirect to dashboard if no parameters
if (!instanceId || !localPort) {
    window.location.href = '/dashboard';
}

// Set tunnel info
const tunnelUrl = `http://localhost:${localPort}`;
document.getElementById('tunnelName').textContent = instanceName || 'Tunnel Instance';
document.getElementById('tunnelUrl').textContent = tunnelUrl;

// Load the tunnel in iframe
const iframe = document.getElementById('tunnelFrame');
const loading = document.getElementById('loading');

iframe.onload = function() {
    loading.style.display = 'none';
    iframe.style.display = 'block';
};

// Set iframe source
iframe.src = tunnelUrl;

// Reload tunnel function
function reloadTunnel() {
    loading.style.display = 'block';
    iframe.style.display = 'none';
    iframe.src = iframe.src;
}

// Open in new window
function openInNewWindow() {
    window.open(tunnelUrl, '_blank', 'width=1200,height=800');
}

// Make functions global
window.reloadTunnel = reloadTunnel;
window.openInNewWindow = openInNewWindow;
