# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.6.x   | :white_check_mark: |
| < 0.6   | :x:                |

## Security Tools & Processes

### Automated Security Scanning

This project uses multiple layers of security scanning:

#### Rust Dependencies
- **cargo-audit**: Scans for known vulnerabilities in Rust dependencies
- **Clippy**: Catches common security pitfalls and code quality issues
- **rustfmt**: Ensures consistent, readable code

#### Node.js Dependencies
- **npm audit**: Identifies vulnerabilities in Node.js packages
- **Dependency Review**: GitHub's built-in dependency scanning

### Running Security Checks Locally

#### Quick Security Audit
```bash
./security-audit.sh
```

#### Individual Scans

**Rust:**
```bash
# Install cargo-audit (one-time)
cargo install cargo-audit

# Run audit
cargo audit

# Run clippy
./clippy.sh
# or
cargo clippy --all-targets --all-features -- -D warnings
```

**Node.js:**
```bash
cd backend
npm audit --audit-level=moderate
npm audit fix  # Auto-fix where possible
```

### CI/CD Integration

Security checks run automatically on:
- Every push to `main` or `develop` branches
- Every pull request
- Daily at 2 AM UTC (scheduled scan)

Workflows:
- `.github/workflows/security-audit.yml` - Dependency vulnerability scanning
- `.github/workflows/code-quality.yml` - Code quality and linting
- `.github/workflows/integration-tests.yml` - Full integration tests

## Known Security Issues & Mitigations

### Fixed Vulnerabilities

1. **Auth Bypass in Legacy Mode** (HIGH)
   - **Issue**: Clients could bypass HMAC validation by sending Authenticate message
   - **Fix**: Server rejects Authenticate when backend disabled + legacy auth enabled
   - **Version**: Fixed in 0.6.0
   - **Mitigation**: Upgrade to 0.6.0+

2. **Concurrent Tunnel Limit Race** (MEDIUM)
   - **Issue**: Race condition allowed exceeding tunnel limits
   - **Fix**: Atomic check-and-increment using DashMap entry API
   - **Version**: Fixed in 0.6.0
   - **Mitigation**: Upgrade to 0.6.0+

3. **Legacy Secret Misdetection** (HIGH)
   - **Issue**: 64-char hex secrets misidentified as API keys, breaking auth
   - **Fix**: Only explicit prefixes (sk_, tk_) trigger modern auth
   - **Version**: Fixed in 0.6.0
   - **Mitigation**: Upgrade to 0.6.0+

## Reporting a Vulnerability

### Where to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security issues to:
- **Email**: security@bore.example.com (replace with actual email)
- **GitHub Security Advisories**: Use the "Security" tab → "Report a vulnerability"

### What to Include

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact and attack scenarios
3. **Reproduction**: Steps to reproduce the issue
4. **Environment**: Versions, operating system, configuration
5. **Proof of Concept**: Code or commands demonstrating the issue (if applicable)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next release cycle

### Disclosure Policy

- We follow **coordinated disclosure**
- Security advisories published after patch is available
- Credit given to reporters (unless anonymity requested)

## Security Best Practices

### For Operators

1. **Keep Dependencies Updated**
   ```bash
   cargo update
   cd backend && npm update
   ```

2. **Use Environment Variables**
   - Never commit secrets to version control
   - Use `.env` files (ignored by git)
   - Rotate API keys regularly

3. **Enable Redis for Production**
   - Required for multi-node deployments
   - Ensures consistent state across nodes

4. **Run Regular Audits**
   ```bash
   ./security-audit.sh
   ```

5. **Monitor Logs**
   - Watch for authentication failures
   - Alert on unusual tunnel counts
   - Track capacity metrics

### For Developers

1. **Authentication**
   - Use API keys (sk_) for programmatic access
   - Use tunnel tokens (tk_) for tunnel connections
   - Legacy HMAC only for backward compatibility

2. **Input Validation**
   - Always validate user input
   - Use parameterized queries (SQL injection prevention)
   - Sanitize data before storage/display

3. **Rate Limiting**
   - Respect rate limits in API clients
   - Implement exponential backoff
   - Handle 429 responses gracefully

4. **Error Handling**
   - Don't expose sensitive info in errors
   - Log errors securely (no credentials)
   - Use generic error messages for users

## Security Checklist

Before deploying:

- [ ] All dependencies up to date
- [ ] Security audit passes
- [ ] Integration tests pass
- [ ] Environment variables configured
- [ ] TLS/SSL enabled for production
- [ ] Database migrations applied
- [ ] Redis configured (if multi-node)
- [ ] Logging and monitoring enabled
- [ ] Rate limits configured
- [ ] Firewall rules applied

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-guide/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
