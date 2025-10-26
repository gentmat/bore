interface User {
    id: string;
    email: string;
    name: string;
    plan: string;
    isAdmin: boolean;
    isBanned: boolean;
    planExpires: string | null;
    createdAt: string;
    updatedAt: string;
}

interface Instance {
    id: string;
    userId: string;
    name: string;
    localPort: number;
    remotePort: number | null;
    region: string;
    serverHost: string | null;
    status: string;
    publicUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

interface SystemStats {
    totalUsers: number;
    totalInstances: number;
    activeInstances: number;
    totalBandwidthGb: number;
    planDistribution: { plan: string; count: number }[];
}

const API_BASE = window.location.origin;
const token = localStorage.getItem('token');

// Check authentication
if (!token) {
    window.location.href = '/login';
}

// Set admin name
const adminName = localStorage.getItem('user_name');
if (adminName) {
    document.getElementById('adminName')!.textContent = adminName;
}

// Logout handler
document.getElementById('logoutBtn')!.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    window.location.href = '/login';
});

/**
 * Verify admin access on page load
 */
async function verifyAdminAccess(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to verify admin access');
        }

        const data = await response.json();
        
        if (!data.is_admin) {
            alert('Access Denied: Admin privileges required');
            window.location.href = '/dashboard';
            return;
        }

        // Admin verified, load dashboard data
        await Promise.all([
            loadStats(),
            loadUsers(),
            loadInstances()
        ]);
    } catch (error) {
        console.error('Admin verification error:', error);
        alert('Failed to verify admin access. Redirecting to login.');
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
}

/**
 * Load system statistics
 */
async function loadStats(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load stats');
        }

        const data = await response.json();
        const stats: SystemStats = data.stats;

        // Update stat cards
        document.getElementById('totalUsers')!.textContent = stats.totalUsers.toString();
        document.getElementById('totalInstances')!.textContent = stats.totalInstances.toString();
        document.getElementById('activeInstances')!.textContent = stats.activeInstances.toString();
        document.getElementById('totalBandwidth')!.textContent = stats.totalBandwidthGb.toFixed(2);

        // Update plan distribution chart
        renderPlanChart(stats.planDistribution);
    } catch (error) {
        console.error('Load stats error:', error);
        showError('statsContainer', 'Failed to load system statistics');
    }
}

/**
 * Render plan distribution chart
 */
function renderPlanChart(planDistribution: { plan: string; count: number }[]): void {
    const container = document.getElementById('planChart')!;
    
    if (planDistribution.length === 0) {
        container.innerHTML = '<div class="empty-state">No plan data available</div>';
        return;
    }

    container.innerHTML = planDistribution.map(item => `
        <div class="plan-item">
            <div class="plan-item-label">${item.plan}</div>
            <div class="plan-item-count">${item.count}</div>
        </div>
    `).join('');
}

/**
 * Load all users
 */
async function loadUsers(): Promise<void> {
    const container = document.getElementById('usersTableContainer')!;
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        const users: User[] = data.users;

        if (users.length === 0) {
            container.innerHTML = '<div class="empty-state">No users found</div>';
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Expires</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td><span class="user-email">${escapeHtml(user.email)}</span></td>
                            <td>${escapeHtml(user.name)}</td>
                            <td><span class="badge ${user.plan}">${user.plan}</span></td>
                            <td>
                                ${user.isAdmin ? '<span class="badge admin">Admin</span>' : ''}
                                ${user.isBanned ? '<span class="badge" style="background: #ef4444;">Banned</span>' : ''}
                            </td>
                            <td class="timestamp">${formatDate(user.createdAt)}</td>
                            <td class="timestamp">${user.planExpires ? formatDate(user.planExpires) : 'Never'}</td>
                            <td>
                                ${!user.isAdmin ? `
                                    <button 
                                        class="action-btn ${user.isBanned ? 'success' : 'danger'}" 
                                        onclick="toggleBanUser('${user.id}', ${user.isBanned})"
                                        title="${user.isBanned ? 'Unban user' : 'Ban user'}">
                                        ${user.isBanned ? '✓ Unban' : '🚫 Ban'}
                                    </button>
                                ` : '<span style="color: #9ca3af;">—</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Load users error:', error);
        showError('usersTableContainer', 'Failed to load users');
    }
}

/**
 * Load all instances
 */
async function loadInstances(): Promise<void> {
    const container = document.getElementById('instancesTableContainer')!;
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/instances`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load instances');
        }

        const data = await response.json();
        const instances: Instance[] = data.instances;

        if (instances.length === 0) {
            container.innerHTML = '<div class="empty-state">No instances found</div>';
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Instance ID</th>
                        <th>Name</th>
                        <th>User ID</th>
                        <th>Region</th>
                        <th>Status</th>
                        <th>Local Port</th>
                        <th>Remote Port</th>
                        <th>Public URL</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${instances.map(instance => `
                        <tr>
                            <td><code style="font-size: 11px;">${escapeHtml(instance.id)}</code></td>
                            <td><strong>${escapeHtml(instance.name)}</strong></td>
                            <td><code style="font-size: 11px;">${escapeHtml(instance.userId)}</code></td>
                            <td>${escapeHtml(instance.region)}</td>
                            <td><span class="badge ${instance.status}">${instance.status}</span></td>
                            <td>${instance.localPort}</td>
                            <td>${instance.remotePort || '-'}</td>
                            <td>${instance.publicUrl ? `<code style="font-size: 11px;">${escapeHtml(instance.publicUrl)}</code>` : '-'}</td>
                            <td class="timestamp">${formatDate(instance.createdAt)}</td>
                            <td>
                                ${instance.status !== 'inactive' ? `
                                    <button 
                                        class="action-btn danger" 
                                        onclick="disconnectInstance('${instance.id}')"
                                        title="Force disconnect">
                                        ⚡ Disconnect
                                    </button>
                                ` : '<span style="color: #9ca3af;">—</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Load instances error:', error);
        showError('instancesTableContainer', 'Failed to load instances');
    }
}

/**
 * Show error message in a container
 */
function showError(containerId: string, message: string): void {
    const container = document.getElementById(containerId)!;
    container.innerHTML = `
        <div class="error-message">
            ⚠️ ${escapeHtml(message)}
        </div>
    `;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Toggle ban/unban user
 */
async function toggleBanUser(userId: string, isBanned: boolean): Promise<void> {
    const action = isBanned ? 'unban' : 'ban';
    const confirmMsg = isBanned 
        ? 'Are you sure you want to unban this user? They will regain access to the system.'
        : 'Are you sure you want to ban this user? They will be immediately logged out and unable to access the system.';
    
    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/${action}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || `Failed to ${action} user`);
        }

        alert(`User ${action}ned successfully!`);
        await loadUsers();
    } catch (error) {
        console.error(`${action} user error:`, error);
        alert(`Failed to ${action} user: ${(error as Error).message}`);
    }
}

/**
 * Force disconnect instance
 */
async function disconnectInstance(instanceId: string): Promise<void> {
    if (!confirm('Are you sure you want to force disconnect this instance? The tunnel will be immediately terminated.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/instances/${instanceId}/disconnect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to disconnect instance');
        }

        alert('Instance disconnected successfully!');
        await loadInstances();
    } catch (error) {
        console.error('Disconnect instance error:', error);
        alert(`Failed to disconnect instance: ${(error as Error).message}`);
    }
}

// Make functions globally available
(window as any).toggleBanUser = toggleBanUser;
(window as any).disconnectInstance = disconnectInstance;
(window as any).loadUsers = loadUsers;
(window as any).loadInstances = loadInstances;

/**
 * Auto-refresh data every 30 seconds
 */
setInterval(() => {
    loadStats();
    loadUsers();
    loadInstances();
}, 30000);

// Initial load
verifyAdminAccess();
