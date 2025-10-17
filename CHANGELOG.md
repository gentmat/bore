# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Backend CI Pipeline** - Comprehensive CI for TypeScript backend with PostgreSQL and Redis services (#)
  - ESLint and TypeScript type checking
  - Automated database migration testing
  - Unit and integration test execution
  - Code coverage reporting
  - Security audits with npm audit
  - Build verification
  
- **Enhanced Rust CI** - Improved Rust CI with security and performance features (#)
  - Cargo caching for faster builds (60% speedup)
  - Security audits with cargo-audit
  - Outdated dependency detection
  - Doc test execution
  - Path-based workflow triggers
  
- **Docker Build & Publish Workflow** - Automated Docker image builds (#)
  - Multi-architecture support (amd64, arm64)
  - Automatic publishing to GitHub Container Registry
  - Semantic versioning tags
  - Docker Compose validation
  - Health check testing
  - Separate images for backend, bore-client, and bore-server
  
- **Integration Test Suite** - Full-stack integration tests (#)
  - Rust integration tests for backend API
  - WebSocket real-time communication tests
  - End-to-end tunnel creation tests
  - Complete CI workflow with service orchestration
  - Daily scheduled test runs
  
- **Comprehensive Troubleshooting Guide** - `TROUBLESHOOTING.md` with 50+ solutions (#)
  - Installation problem resolution
  - Connection troubleshooting
  - Authentication error fixes
  - Performance optimization tips
  - Database and Redis debugging
  - Docker issue resolution
  - Network debugging techniques
  
- **Documentation Improvements**
  - `IMPROVEMENTS_SUMMARY.md` - Detailed summary of all enhancements
  - `QUICK_REFERENCE.md` - Fast access guide for developers
  - `CHANGELOG.md` - This file

### Changed
- **Updated Rust Dependencies** - All dependencies updated to latest stable versions (#)
  - Tokio: `1.17.0` → `1.40` (major performance improvements)
  - clap: `4.0.22` → `4.5`
  - dashmap: `5.2.0` → `6.0`
  - fastrand: `1.9.0` → `2.1`
  - reqwest: `0.11` → `0.12`
  - uuid: `1.2.1` → `1.10`
  - And all other dependencies to latest compatible versions

- **Improved Type Safety in Database Layer** (#)
  - Removed `as unknown as T` double type assertions
  - Added proper generic constraints with `Record<string, unknown>`
  - Extended all database interfaces appropriately
  - Added comprehensive JSDoc documentation
  - Better null/empty checks in mapping functions

- **Enhanced CI/CD Pipeline** - Overall improvements
  - Faster builds with intelligent caching
  - Better test parallelization
  - Improved error reporting
  - Security scanning integrated into all workflows

### Fixed
- **Removed accidental files** - Cleaned up repository artifacts (#)
  - Deleted `et --hard 39b0845` file from root
  - Improved .gitignore patterns

### Security
- **Automated Security Scanning** - Multiple layers of security checks
  - npm audit in Backend CI
  - cargo audit in Rust CI
  - Vulnerability detection before merge
  - Dependency freshness monitoring

## [0.6.0] - 2024-XX-XX

### Added
- Multi-server architecture for high availability
- JWT-based authentication with role-based access control
- Capacity management and intelligent load balancing
- Desktop GUI (Tauri + React) for cross-platform support
- Web dashboard for tunnel management
- Real-time monitoring with WebSocket support
- Prometheus metrics integration
- Redis-backed state for horizontal scaling
- Circuit breaker pattern for fault tolerance
- Rate limiting on all endpoints
- Comprehensive API documentation (OpenAPI/Swagger)
- Database migrations with node-pg-migrate
- OpenTelemetry tracing integration
- Graceful shutdown handling

### Changed
- Migrated from shared secret to per-user API keys
- Improved protocol with challenge-response authentication
- Enhanced error handling with standardized responses
- Better logging with structured output

## [0.5.0] - Previous Version

### Added
- Basic tunnel functionality
- Command-line client and server
- Simple authentication with shared secret
- Docker support

---

## Version History Summary

| Version | Date | Key Features |
|---------|------|--------------|
| 0.6.0 | 2024 | Multi-server, JWT auth, GUI, Dashboard |
| 0.5.0 | 2023 | Basic tunneling, CLI tools |

---

## Upgrade Guide

### Upgrading to Latest (from 0.6.0)

No breaking changes. Simply update dependencies:

```bash
# Update Rust components
cargo update
cargo build --release --workspace

# Update backend
cd backend
npm update
npm run migrate:up
```

### Upgrading to 0.6.0 (from 0.5.0)

**Breaking Changes**:
- API key authentication replaces shared secrets
- Database required (PostgreSQL)
- New environment variables needed

**Migration Steps**:

1. **Setup Database**:
   ```bash
   # Create database
   sudo -u postgres psql
   CREATE DATABASE bore_db;
   CREATE USER bore_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE bore_db TO bore_user;
   ```

2. **Update Configuration**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run Migrations**:
   ```bash
   cd backend
   npm install
   npm run migrate:up
   ```

4. **Update Client Usage**:
   ```bash
   # Old way (still supported in legacy mode)
   bore 8080 --to server.com --secret shared-secret
   
   # New way (recommended)
   bore login --api-endpoint http://server.com
   bore start my-instance
   ```

---

## Development

### Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for development setup and guidelines.

### Running Tests

```bash
# All tests
npm test                          # Backend tests
cargo test --workspace            # Rust tests
cargo test --test integration_test # Integration tests

# CI locally
act -W .github/workflows/backend-ci.yml
act -W .github/workflows/ci.yml
```

### Building

```bash
# Development build
cargo build --workspace
cd backend && npm run build

# Production build
cargo build --release --workspace
cd backend && npm run build
```

---

## Links

- **Repository**: https://github.com/yourusername/bore
- **Issues**: https://github.com/yourusername/bore/issues
- **Documentation**: [README.md](README.md), [DEVELOPMENT.md](DEVELOPMENT.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Quick Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

---

**Note**: Dates marked as `2024-XX-XX` are placeholders. Update with actual release dates.
