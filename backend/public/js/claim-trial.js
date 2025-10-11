const API_BASE = window.location.origin;

// Check authentication
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/signup';
}

async function claimPlan(planType) {
    const messageBox = document.getElementById('message');
    messageBox.classList.remove('show', 'success', 'error');
    
    try {
        const response = await fetch(`${API_BASE}/api/user/claim-plan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan: planType })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to claim plan');
        }
        
        // Store plan info
        localStorage.setItem('user_plan', planType);
        localStorage.setItem('plan_expires', data.expires_at);
        
        // Show success message
        messageBox.textContent = `✓ ${planType === 'trial' ? 'Free trial' : 'Pro plan'} activated! Redirecting to dashboard...`;
        messageBox.classList.add('show', 'success');
        
        // Show connection instructions modal
        setTimeout(() => {
            showConnectionInstructions(data);
        }, 1500);
        
    } catch (error) {
        messageBox.textContent = error.message || 'An error occurred. Please try again.';
        messageBox.classList.add('show', 'error');
    }
}

function showConnectionInstructions(data) {
    const email = localStorage.getItem('user_email');
    const password = '(your password)'; // Don't store password in localStorage
    
    const modal = document.createElement('div');
    modal.className = 'connection-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🎉 Welcome to Bore!</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            
            <p style="margin-bottom: 16px;">Your account is ready! Here's how to connect your tunnels:</p>
            
            <h3 style="margin: 24px 0 12px; font-size: 18px;">Option 1: Use the Dashboard</h3>
            <p style="margin-bottom: 16px; color: #6b7280;">
                Simply go to your dashboard and click "Connect" on any tunnel instance. 
                The dashboard will provide you with the exact command to run.
            </p>
            <button class="btn btn-primary" onclick="goToDashboard()" style="width: 100%; margin-bottom: 24px;">
                Go to Dashboard
            </button>
            
            <h3 style="margin: 24px 0 12px; font-size: 18px;">Option 2: Use CLI with Credentials</h3>
            <p style="margin-bottom: 16px; color: #6b7280;">
                Install the bore client and authenticate with your credentials:
            </p>
            
            <ol class="step-list" style="margin-bottom: 24px;">
                <li>
                    <strong>Install Bore Client:</strong>
                    <div class="code-block">cargo install --path bore-client</div>
                </li>
                <li>
                    <strong>Login with your credentials:</strong>
                    <div class="code-block">bore login --email ${email}</div>
                    <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">
                        You'll be prompted for your password
                    </p>
                </li>
                <li>
                    <strong>Start a tunnel:</strong>
                    <div class="code-block">bore 8080 --to 127.0.0.1</div>
                    <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">
                        The client will automatically use your stored credentials
                    </p>
                </li>
            </ol>
            
            <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin-top: 24px;">
                <strong style="color: #10b981;">💡 Pro Tip:</strong>
                <p style="margin-top: 8px; font-size: 14px; color: #059669;">
                    Your credentials are stored securely. You only need to login once, 
                    and all future tunnel connections will authenticate automatically!
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.querySelector('.connection-modal');
    if (modal) {
        modal.remove();
    }
    goToDashboard();
}

function goToDashboard() {
    window.location.href = '/dashboard';
}

// Make functions global
window.claimPlan = claimPlan;
window.closeModal = closeModal;
window.goToDashboard = goToDashboard;
