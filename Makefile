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
	@echo "  make integration-tests  - Run integration tests (requires servers)"
	@echo ""
	@echo "Development:"
	@echo "  make install            - Install all dependencies"
	@echo "  make build              - Build all components"
	@echo "  make clean              - Clean build artifacts"
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

integration-tests:
	@echo "🔗 Running integration tests..."
	@echo "⚠️  Requires running backend and bore-server"
	cargo test --workspace --test '*' -- --ignored

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
	@echo "🐳 Building Docker images..."
	docker-compose build

docker-up:
	@echo "🐳 Starting Docker services..."
	docker-compose up -d

docker-down:
	@echo "🐳 Stopping Docker services..."
	docker-compose down

docker-logs:
	@echo "📋 Showing Docker logs..."
	docker-compose logs -f

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

# CI/CD Simulation
ci-check: format-check lint audit test
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
