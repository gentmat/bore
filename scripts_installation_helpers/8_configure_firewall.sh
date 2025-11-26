#!/bin/bash
# Configure firewall for Bore

set -e

echo "=== Firewall Configuration ==="
echo ""
echo "This script configures iptables for Bore."
echo ""
echo "Ports to open:"
echo "  - 3000  (Backend API)"
echo "  - 7835  (Bore Server control)"
echo "  - 1024-65535 (Tunnel ports)"
echo ""
read -p "Continue? (y/n): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Check for ufw or iptables
if command -v ufw &> /dev/null; then
    echo ""
    echo "Using UFW..."
    sudo ufw allow 3000/tcp comment 'Bore Backend API'
    sudo ufw allow 7835/tcp comment 'Bore Server Control'
    
    echo ""
    read -p "Open tunnel port range 1024-65535? (y/n): " OPEN_TUNNELS
    if [[ "$OPEN_TUNNELS" =~ ^[Yy]$ ]]; then
        sudo ufw allow 1024:65535/tcp comment 'Bore Tunnel Ports'
    fi
    
    sudo ufw reload
    echo ""
    sudo ufw status
else
    echo ""
    echo "Using iptables..."
    sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 7835 -j ACCEPT
    
    echo ""
    read -p "Open tunnel port range 1024-65535? (y/n): " OPEN_TUNNELS
    if [[ "$OPEN_TUNNELS" =~ ^[Yy]$ ]]; then
        sudo iptables -A INPUT -p tcp --dport 1024:65535 -j ACCEPT
    fi
    
    # Save iptables rules
    if command -v iptables-save &> /dev/null; then
        sudo iptables-save | sudo tee /etc/iptables/iptables.rules > /dev/null
        echo "Rules saved to /etc/iptables/iptables.rules"
    fi
fi

echo ""
echo "✅ Firewall configured!"
