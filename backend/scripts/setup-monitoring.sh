#!/bin/bash

# Bore Monitoring Setup Script
# Sets up Prometheus and Grafana with pre-configured dashboards

set -e

echo "🚀 Setting up Bore Monitoring Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "docker-compose is not installed. Please install it first."
    exit 1
fi

# Create necessary directories
print_status "Creating monitoring directories..."
mkdir -p grafana/{provisioning/{datasources,dashboards},dashboards}

# Set proper permissions
chmod 755 grafana/provisioning
chmod 644 grafana/provisioning/datasources/prometheus.yml
chmod 644 grafana/provisioning/dashboards/dashboard.yml
chmod 644 grafana/dashboards/*.json

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from template..."
    cp .env.example .env 2>/dev/null || cat > .env << EOF
# Database Configuration
DB_PASSWORD=postgres

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
INTERNAL_API_KEY=d3f08e6d4c9a4f0fb7e5c2a1bd98f4ce

# Grafana
GRAFANA_PASSWORD=admin123

# Enable Master Tunnel (for testing)
ENABLE_MASTER_TUNNEL=true

# Monitoring
COMPOSE_PROFILES=monitoring
EOF
    print_warning "Please review and update the .env file before continuing."
fi

# Load environment variables
source .env

print_status "Starting monitoring stack..."

# Start the monitoring stack
docker-compose --profile monitoring up -d prometheus grafana

print_status "Waiting for services to be ready..."

# Wait for Prometheus to be ready
echo -n "Waiting for Prometheus..."
while ! curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo " ✅"

# Wait for Grafana to be ready
echo -n "Waiting for Grafana..."
while ! curl -f http://localhost:3001/api/health > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo " ✅"

print_status "Monitoring stack is ready!"

# Display access information
echo ""
echo "🎯 Monitoring Services:"
echo "  • Prometheus: http://localhost:9090"
echo "  • Grafana: http://localhost:3001"
echo ""
echo "📊 Grafana Login:"
echo "  • Username: admin"
echo "  • Password: ${GRAFANA_PASSWORD:-admin}"
echo ""
echo "📈 Available Dashboards:"
echo "  • Bore Overview Dashboard"
echo "  • Bore Performance Dashboard"
echo "  • Bore System Dashboard"
echo ""
echo "🔍 Health Checks:"
echo "  • Backend Health: http://localhost:3000/health"
echo "  • Metrics Endpoint: http://localhost:3000/metrics"
echo ""

print_status "Setup complete! You can now view your Bore metrics in Grafana."

# Optional: Start the full application
read -p "Do you want to start the full Bore application? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting full Bore application..."
    docker-compose --profile monitoring --profile tunnel up -d
    print_status "Full application is now running!"
fi

echo ""
print_status "Useful commands:"
echo "  • View logs: docker-compose logs -f"
echo "  • Stop services: docker-compose down"
echo "  • Stop monitoring: docker-compose --profile monitoring down"
echo ""