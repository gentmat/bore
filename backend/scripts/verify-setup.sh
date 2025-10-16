#!/bin/bash

# Verification Script for Medium Priority Features
# Checks that all new features are properly set up

set -e

echo "🔍 Bore Backend Setup Verification"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "📦 Checking Dependencies..."
echo "----------------------------"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed ($NODE_VERSION)"
else
    check_fail "Node.js not found"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm installed ($NPM_VERSION)"
else
    check_fail "npm not found"
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    check_pass "PostgreSQL installed ($PSQL_VERSION)"
else
    check_fail "PostgreSQL not found"
fi

echo ""
echo "📁 Checking Files..."
echo "----------------------------"

# Check migration files
if [ -f "database.config.js" ]; then
    check_pass "Migration config exists"
else
    check_fail "Migration config missing"
fi

if [ -d "migrations" ]; then
    MIGRATION_COUNT=$(find migrations -name "*.js" | wc -l)
    check_pass "Migrations directory exists ($MIGRATION_COUNT migrations)"
else
    check_fail "Migrations directory missing"
fi

# Check E2E test files
if [ -d "tests/e2e" ]; then
    TEST_COUNT=$(find tests/e2e -name "*.test.js" | wc -l)
    check_pass "E2E tests directory exists ($TEST_COUNT test files)"
else
    check_fail "E2E tests directory missing"
fi

# Check scripts
if [ -d "scripts" ]; then
    SCRIPT_COUNT=$(find scripts -name "*.sh" | wc -l)
    check_pass "Scripts directory exists ($SCRIPT_COUNT scripts)"
else
    check_fail "Scripts directory missing"
fi

# Check documentation
DOCS_EXIST=0
for doc in QUICKSTART.md IMPLEMENTATION_SUMMARY.md CHANGES.md; do
    if [ -f "$doc" ]; then
        ((DOCS_EXIST++))
    fi
done
if [ $DOCS_EXIST -eq 3 ]; then
    check_pass "All documentation files exist"
else
    check_fail "Some documentation files missing ($DOCS_EXIST/3)"
fi

echo ""
echo "📦 Checking Node Modules..."
echo "----------------------------"

if [ -d "node_modules" ]; then
    check_pass "node_modules directory exists"
    
    # Check critical dependencies
    if [ -d "node_modules/swagger-ui-express" ]; then
        check_pass "swagger-ui-express installed"
    else
        check_fail "swagger-ui-express not installed"
    fi
    
    if [ -d "node_modules/yamljs" ]; then
        check_pass "yamljs installed"
    else
        check_fail "yamljs not installed"
    fi
    
    if [ -d "node_modules/node-pg-migrate" ]; then
        check_pass "node-pg-migrate installed"
    else
        check_fail "node-pg-migrate not installed"
    fi
    
    if [ -d "node_modules/supertest" ]; then
        check_pass "supertest installed"
    else
        check_fail "supertest not installed"
    fi
else
    check_fail "node_modules not found - run 'npm install'"
fi

echo ""
echo "🗄️  Checking Database..."
echo "----------------------------"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs) 2>/dev/null || true
fi

DB_NAME=${DB_NAME:-bore_db}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Check if database exists
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME; then
    check_pass "Database '$DB_NAME' exists"
    
    # Check if migrations table exists
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pgmigrations');" 2>/dev/null | grep -q "t"; then
        check_pass "Migrations table exists"
        
        # Count applied migrations
        MIGRATION_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM pgmigrations;" 2>/dev/null || echo "0")
        check_pass "Applied migrations: $MIGRATION_COUNT"
    else
        check_warn "Migrations table not found - run 'npm run migrate:up'"
    fi
    
    # Check if users table exists
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');" 2>/dev/null | grep -q "t"; then
        check_pass "Users table exists"
    else
        check_fail "Users table missing - run migrations"
    fi
else
    check_fail "Database '$DB_NAME' not found"
fi

echo ""
echo "🧪 Checking Test Database..."
echo "----------------------------"

TEST_DB_NAME=${TEST_DB_NAME:-bore_db_test}

if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $TEST_DB_NAME; then
    check_pass "Test database '$TEST_DB_NAME' exists"
else
    check_warn "Test database not found - run './scripts/setup-test-db.sh'"
fi

echo ""
echo "📝 Checking Configuration..."
echo "----------------------------"

if [ -f ".env" ]; then
    check_pass ".env file exists"
else
    check_warn ".env file missing - copy from .env.example"
fi

if [ -f "package.json" ]; then
    # Check if test:e2e script exists
    if grep -q "test:e2e" package.json; then
        check_pass "E2E test script configured"
    else
        check_fail "E2E test script missing"
    fi
    
    # Check if migrate scripts exist
    if grep -q "migrate:up" package.json; then
        check_pass "Migration scripts configured"
    else
        check_fail "Migration scripts missing"
    fi
fi

echo ""
echo "===================================="
echo "📊 Summary"
echo "===================================="
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to go.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start server: npm run dev"
    echo "  2. View docs: http://localhost:3000/api/v1/docs"
    echo "  3. Run tests: npm run test:all"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review errors above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Run: npm install"
    echo "  - Run: npm run migrate:up"
    echo "  - Run: ./scripts/setup-test-db.sh"
    exit 1
fi
