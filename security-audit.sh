#!/bin/bash
# Comprehensive Security Audit Script
# Runs security checks on both Rust and Node.js dependencies

set -e

echo "🔒 Starting Security Audit"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if cargo-audit is installed
if ! command -v cargo-audit &> /dev/null; then
    echo "📦 Installing cargo-audit..."
    cargo install cargo-audit
fi

# Rust Security Audit
echo "🦀 Running Rust security audit..."
echo "----------------------------"
if cargo audit; then
    echo -e "${GREEN}✅ No Rust vulnerabilities found!${NC}"
else
    echo -e "${RED}❌ Rust vulnerabilities detected!${NC}"
    RUST_FAILED=1
fi
echo ""

# Node.js Security Audit (Backend)
if [ -d "backend" ]; then
    echo "📦 Running Node.js security audit (backend)..."
    echo "----------------------------"
    cd backend
    
    # npm audit
    if npm audit --audit-level=moderate; then
        echo -e "${GREEN}✅ No Node.js vulnerabilities found!${NC}"
    else
        echo -e "${YELLOW}⚠️  Node.js vulnerabilities detected!${NC}"
        echo "Run 'cd backend && npm audit fix' to attempt automatic fixes"
        NODE_FAILED=1
    fi
    cd ..
    echo ""
fi

# Summary
echo "=========================="
echo "📊 Security Audit Summary"
echo "=========================="
if [ -z "$RUST_FAILED" ] && [ -z "$NODE_FAILED" ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Security issues found. Please review and fix.${NC}"
    exit 1
fi
