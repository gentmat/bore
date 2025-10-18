# Security & Quality Tooling Setup

## Overview

This document describes the security and quality tooling that has been set up for the Bore project.

## 📋 What Was Added

### 1. Rust Security Tools

#### cargo-audit
- **Purpose**: Scans Rust dependencies for known vulnerabilities
- **Configuration**: `.cargo-audit.toml`
- **Install**: `cargo install cargo-audit`
- **Usage**: `cargo audit` or `make audit-rust`

#### clippy
- **Purpose**: Lint tool for catching common mistakes and improving code quality
- **Configuration**: `.clippy.toml`
- **Usage**: `./clippy.sh` or `make lint-rust`
- **Rules**: Strict warnings enabled, some pedantic checks

### 2. Node.js Security Tools

#### npm audit
- **Purpose**: Identifies security vulnerabilities in npm packages
- **Configuration**: `backend/.npmrc`
- **Usage**: `cd backend && npm audit` or `make audit-node`
- **Auto-fix**: `cd backend && npm audit fix`

#### Package Configuration
- **File**: `backend/package.json.security`
- **Scripts**: Predefined security check commands
- **Overrides**: Ability to force specific package versions

### 3. Integration Tests

#### Test Structure
```
tests/integration/
├── README.md                    # Documentation
├── test_full_flow.rs           # Complete tunnel lifecycle tests
├── test_auth_flows.rs          # All authentication scenarios
└── fixtures/                   # Test helpers (to be added)
```

#### Test Categories
1. **Full Flow Tests**: End-to-end tunnel creation and usage
2. **Auth Tests**: All authentication methods and edge cases
3. **Concurrent Tests**: Multi-tunnel scenarios
4. **Reconnection Tests**: Connection resilience

#### Running Integration Tests
```bash
# Start required services first
cd backend && npm start          # Terminal 1
cargo run --bin bore-server     # Terminal 2

# Run tests
cargo test --test '*' -- --ignored
# or
make integration-tests
```

### 4. GitHub Actions Workflows

Three automated workflows were created:

#### Security Audit (`.github/workflows/security-audit.yml`)
- **Triggers**: Push, PR, daily at 2 AM UTC
- **Jobs**:
  - Rust dependency audit (cargo-audit)
  - Node.js dependency audit (npm audit)
  - Dependency review for PRs
- **Artifacts**: Audit results uploaded on failure

#### Code Quality (`.github/workflows/code-quality.yml`)
- **Triggers**: Push, PR
- **Jobs**:
  - Rust clippy linting
  - Rust format checking (rustfmt)
  - TypeScript type checking
  - Test coverage (cargo-tarpaulin)
- **Coverage**: Uploaded to Codecov

#### Integration Tests (`.github/workflows/integration-tests.yml`)
- **Triggers**: Push, PR, manual
- **Services**: PostgreSQL, Redis
- **Jobs**:
  - Backend server startup
  - bore-server startup
  - Full integration test suite
  - Cleanup on completion

### 5. Helper Scripts

#### `security-audit.sh`
Comprehensive security audit script:
```bash
./security-audit.sh
```
- Installs cargo-audit if needed
- Runs Rust security audit
- Runs Node.js security audit
- Color-coded output
- Exit code indicates pass/fail

#### `clippy.sh`
Strict Clippy checks:
```bash
./clippy.sh
```
- All targets and features
- Warnings as errors
- Pedantic and nursery lints
- Some exceptions for documentation

### 6. Makefile

Convenient make targets for common tasks:

```bash
# Security
make audit              # Run all security audits
make audit-rust         # Rust only
make audit-node         # Node.js only

# Quality
make lint               # Run all linters
make format             # Format all code
make format-check       # Check formatting

# Testing
make test               # All tests
make test-rust          # Rust tests
make test-backend       # Backend tests
make integration-tests  # Integration tests
make coverage           # Generate coverage

# Development
make install            # Install dependencies
make build              # Build everything
make clean              # Clean artifacts

# CI/CD Simulation
make ci-check           # Run all CI checks locally
make pre-commit         # Quick pre-commit checks
```

### 7. Documentation

#### SECURITY.md
Comprehensive security documentation:
- Supported versions
- Security tools overview
- How to report vulnerabilities
- Known issues and mitigations
- Best practices
- Security checklist

## 🚀 Getting Started

### Initial Setup

1. **Install Rust tools:**
   ```bash
   make install-tools
   # or manually:
   cargo install cargo-audit
   cargo install cargo-tarpaulin
   ```

2. **Install Node.js dependencies:**
   ```bash
   cd backend && npm install
   ```

3. **Run initial audit:**
   ```bash
   make audit
   ```

### Daily Workflow

**Before committing:**
```bash
make pre-commit
```

**Before pushing:**
```bash
make ci-check
```

**Weekly security check:**
```bash
make audit
```

## 🔄 CI/CD Integration

### Automatic Checks

All workflows run automatically on:
- Push to main/develop branches
- Pull requests
- Daily scheduled runs (security audit)

### Required Status Checks

Consider requiring these workflows to pass before merging:
- Security Audit
- Code Quality
- Integration Tests (for main branch)

### Branch Protection

Recommended GitHub branch protection rules:
- Require status checks to pass
- Require linear history
- Include administrators
- Require signed commits (optional)

## 📊 Monitoring

### Security Alerts

GitHub will create security alerts for:
- Known vulnerabilities in dependencies
- Dependency review failures on PRs
- Supply chain vulnerabilities

### Coverage Reports

Test coverage is automatically:
- Generated by cargo-tarpaulin
- Uploaded to Codecov
- Displayed in PR comments

## 🛠️ Customization

### Adjusting Security Thresholds

**Rust (`.cargo-audit.toml`):**
```toml
[advisories]
severity-threshold = "Low"  # Change to "Medium" or "High"
ignore = ["RUSTSEC-YYYY-NNNN"]  # Ignore specific advisories
```

**Node.js (`backend/.npmrc`):**
```
audit-level=moderate  # Change to "high" or "critical"
```

### Clippy Rules

Edit `.clippy.toml` or `clippy.sh` to adjust lint rules:
```bash
# In clippy.sh, add or remove:
-W clippy::all
-A clippy::module_name_repetitions  # Allow this pattern
```

### Integration Tests

Add new tests in `tests/integration/`:
```rust
#[tokio::test]
#[ignore = "requires running servers"]
async fn test_my_feature() -> Result<()> {
    // Test implementation
    Ok(())
}
```

## 📚 Resources

- [cargo-audit documentation](https://github.com/RustSec/rustsec/tree/main/cargo-audit)
- [Clippy lint list](https://rust-lang.github.io/rust-clippy/master/)
- [npm audit docs](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [GitHub Actions docs](https://docs.github.com/en/actions)

## 🤝 Contributing

When contributing:
1. Run `make pre-commit` before committing
2. Ensure all tests pass locally
3. Security audit must pass
4. Follow existing code style
5. Add tests for new features

## ❓ Troubleshooting

### cargo-audit fails to install
```bash
# Try with --locked flag
cargo install cargo-audit --locked
```

### npm audit shows vulnerabilities
```bash
# Try auto-fix
cd backend && npm audit fix

# If that doesn't work, check if manual update needed
npm audit
```

### Integration tests fail
```bash
# Ensure services are running
cd backend && npm start      # Terminal 1
cargo run --bin bore-server  # Terminal 2

# Check logs
cd backend && npm run logs
```

### Clippy is too strict
```bash
# Temporarily disable specific lints
cargo clippy -- -A clippy::lint_name
```

## 🎯 Next Steps

1. **Run initial security audit**: `make audit`
2. **Fix any issues found**: Follow output recommendations
3. **Set up GitHub branch protection**: Require workflows to pass
4. **Configure Codecov**: Add repository to Codecov for coverage tracking
5. **Schedule regular reviews**: Weekly security check cadence
6. **Write integration tests**: Flesh out test cases in `tests/integration/`

---

**Note**: This tooling setup provides a solid foundation for security and quality. Adjust thresholds and rules based on your team's needs and risk tolerance.
