# Bore Development & Security Makefile

.PHONY: help install audit test lint format clean docker-build integration-tests

help:
	@echo "Bore Development & Security Commands"
	@echo "===================================="
	@echo ""
	@echo "Security & Quality:"
	@echo "  make audit              - Run security audit (Rust + Node.js)"
	@echo "  make lint               - Run all linters (clippy + tsc)"
	@echo "  make format             - Format code (rustfmt + prettier)"
	@echo ""
	@echo "Testing:"
	@echo "  make test               - Run all unit tests"
	@echo "  make test-rust          - Run Rust tests only"
	@echo "  make test-backend       - Run backend tests only"
	@echo "  make integration-tests  - Run integration tests (full tunnel flow)"
	@echo "  make performance-tests  - Run performance benchmarks and regression tests"
	@echo ""
	@echo "Development:"
	@echo "  make install            - Install all dependencies"
	@echo "  make build              - Build all components"
	@echo "  make clean              - Clean build artifacts"
	@echo ""
	@echo "Monitoring:"
	@echo "  make monitoring-setup   - Setup Prometheus & Grafana with dashboards"
	@echo "  make monitoring-up      - Start monitoring services"
	@echo "  make monitoring-down    - Stop monitoring services"
	@echo "  make monitoring-logs    - Show monitoring logs"
	@echo "  make monitoring-status  - Check monitoring service health"
	@echo ""
	@echo "Kubernetes:"
	@echo "  make k8s-deploy         - Deploy to Kubernetes (development)"
	@echo "  make k8s-deploy-prod    - Deploy to Kubernetes (production)"
	@echo "  make k8s-status         - Show Kubernetes deployment status"
	@echo "  make k8s-cleanup        - Clean Kubernetes deployment"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build       - Build Docker images"
	@echo "  make docker-up          - Start Docker services"
	@echo "  make docker-down        - Stop Docker services"

# Installation
install:
	@echo "📦 Installing dependencies..."
	cargo build
	cd backend && npm install
	@echo "✅ Installation complete!"

install-tools:
	@echo "🔧 Installing development tools..."
	cargo install cargo-audit
	cargo install cargo-tarpaulin
	@echo "✅ Tools installed!"

# Security & Quality
audit:
	@echo "🔒 Running security audit..."
	./security-audit.sh

audit-rust:
	@echo "🦀 Running Rust security audit..."
	cargo audit

audit-node:
	@echo "📦 Running Node.js security audit..."
	cd backend && npm audit

lint:
	@echo "🔍 Running linters..."
	./clippy.sh
	cd backend && npx tsc --noEmit

lint-rust:
	@echo "🦀 Running Rust linter..."
	./clippy.sh

lint-backend:
	@echo "📦 Running TypeScript check..."
	cd backend && npx tsc --noEmit

format:
	@echo "✨ Formatting code..."
	cargo fmt --all
	cd backend && npx prettier --write "**/*.{ts,js,json}"

format-check:
	@echo "🔎 Checking code format..."
	cargo fmt --all -- --check
	cd backend && npx prettier --check "**/*.{ts,js,json}"

# Testing
test: test-rust test-backend
	@echo "✅ All tests passed!"

test-rust:
	@echo "🦀 Running Rust tests..."
	cargo test --workspace --lib

test-backend:
	@echo "📦 Running backend tests..."
	cd backend && npm test

coverage:
	@echo "📊 Generating test coverage..."
	cargo tarpaulin --out Html --output-dir coverage
	@echo "Coverage report: coverage/index.html"

# Build
build: build-rust build-backend
	@echo "✅ Build complete!"

build-rust:
	@echo "🦀 Building Rust workspace..."
	cargo build --release

build-backend:
	@echo "📦 Building backend..."
	cd backend && npm run build

# Clean
clean:
	@echo "🧹 Cleaning build artifacts..."
	cargo clean
	cd backend && rm -rf node_modules dist
	@echo "✅ Clean complete!"

# Docker
docker-build:
	@echo "🔨 Building frontend assets..."
	cd backend && npm run build:frontend
	@echo "🐳 Building Docker images..."
	cd backend && sudo docker-compose build

docker-up: docker-build
	@echo "🐳 Starting Docker services..."
	cd backend && sudo docker-compose up -d

docker-down:
	@echo "🐳 Stopping Docker services..."
	cd backend && sudo docker-compose --profile tunnel --profile monitoring down

# Monitoring
monitoring-setup:
	@echo "📊 Setting up monitoring stack..."
	cd backend && ./scripts/setup-monitoring.sh

monitoring-up:
	@echo "📊 Starting monitoring services..."
	cd backend && sudo docker-compose --profile monitoring up -d

monitoring-down:
	@echo "📊 Stopping monitoring services..."
	cd backend && sudo docker-compose --profile monitoring down

monitoring-logs:
	@echo "📊 Showing monitoring logs..."
	cd backend && sudo docker-compose logs -f prometheus grafana

monitoring-status:
	@echo "📊 Checking monitoring services..."
	@echo "Backend Health:" && curl -s http://localhost:3000/health | jq . || echo "❌ Backend unreachable"
	@echo "Prometheus Health:" && curl -s http://localhost:9090/-/healthy || echo "❌ Prometheus unreachable"
	@echo "Grafana Health:" && curl -s http://localhost:3001/api/health || echo "❌ Grafana unreachable"

docker-logs:
	@echo "📋 Showing Docker logs..."
	cd backend && sudo docker-compose logs -f

# Development
dev-backend:
	@echo "💻 Starting backend in dev mode..."
	cd backend && npm run dev

dev-server:
	@echo "💻 Starting bore-server..."
	cargo run --bin bore-server

watch:
	@echo "👀 Watching for changes..."
	cargo watch -x check -x test

# Integration Tests
integration-tests:
	@echo "🔗 Running integration tests..."
	./tests/run_integration_tests.sh

# Performance Tests
performance-tests:
	@echo "📊 Running performance benchmarks..."
	./tests/run_performance_tests.sh --all

# Kubernetes Deployment
k8s-deploy:
	@echo "🚀 Deploying to Kubernetes (development)..."
	./k8s/deploy.sh deploy -e development

k8s-deploy-prod:
	@echo "🚀 Deploying to Kubernetes (production)..."
	./k8s/deploy.sh deploy -e production --push-images

k8s-status:
	@echo "📋 Kubernetes deployment status..."
	./k8s/deploy.sh status -e development

k8s-status-prod:
	@echo "📋 Kubernetes production status..."
	./k8s/deploy.sh status -e production

k8s-cleanup:
	@echo "🧹 Cleaning Kubernetes deployment..."
	./k8s/deploy.sh cleanup -e development --force-cleanup

k8s-cleanup-prod:
	@echo "🧹 Cleaning Kubernetes production deployment..."
	./k8s/deploy.sh cleanup -e production

# CI/CD Simulation
ci-check: format-check lint audit test integration-tests performance-tests
	@echo "✅ All CI checks passed!"

pre-commit: format lint test-rust
	@echo "✅ Pre-commit checks passed!"

# Database
db-migrate:
	@echo "🗄️  Running database migrations..."
	cd backend && npm run migrate:up

db-rollback:
	@echo "↩️  Rolling back database migrations..."
	cd backend && npm run migrate:down

db-seed:
	@echo "🌱 Seeding database..."
	cd backend && npm run seed
