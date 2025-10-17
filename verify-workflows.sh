#!/bin/bash
# Workflow Verification Script
# This script helps verify that workflow files are valid

set -e

echo "🔍 Verifying GitHub Actions Workflows..."
echo ""

# Check if actionlint is installed
if ! command -v actionlint &> /dev/null; then
    echo "⚠️  actionlint not found. Install it for better workflow validation:"
    echo "   https://github.com/rhysd/actionlint#installation"
    echo ""
fi

# Count workflow files
workflow_count=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
echo "📁 Found $workflow_count workflow files"
echo ""

# Validate YAML syntax
echo "✅ Validating YAML syntax..."
for file in .github/workflows/*.yml .github/workflows/*.yaml; do
    if [ -f "$file" ]; then
        echo "  Checking: $(basename "$file")"
        # Basic YAML validation using Python
        python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>&1 || {
            echo "  ❌ YAML syntax error in $file"
            exit 1
        }
    fi
done
echo "  ✓ All YAML files are valid"
echo ""

# Check for deprecated actions
echo "🔎 Checking for deprecated actions..."
deprecated_found=0

if grep -r "actions-rs/toolchain" .github/workflows/; then
    echo "  ⚠️  Found deprecated actions-rs/toolchain"
    deprecated_found=1
fi

if grep -r "actions-rs/cargo" .github/workflows/; then
    echo "  ⚠️  Found deprecated actions-rs/cargo"
    deprecated_found=1
fi

if [ $deprecated_found -eq 0 ]; then
    echo "  ✓ No deprecated actions found"
fi
echo ""

# Check for action version consistency
echo "📊 Action version summary:"
echo "  actions/checkout:"
grep -r "uses: actions/checkout@" .github/workflows/ | sed 's/.*@/  - v/' | sort | uniq -c

echo "  actions/setup-node:"
grep -r "uses: actions/setup-node@" .github/workflows/ | sed 's/.*@/  - v/' | sort | uniq -c

echo "  docker/build-push-action:"
grep -r "uses: docker/build-push-action@" .github/workflows/ | sed 's/.*@/  - v/' | sort | uniq -c || echo "    (none found)"

echo ""

# Run actionlint if available
if command -v actionlint &> /dev/null; then
    echo "🔧 Running actionlint..."
    actionlint .github/workflows/*.yml || {
        echo "  ⚠️  actionlint found issues"
    }
    echo ""
fi

# Test that required environment variables are documented
echo "📝 Checking environment variable documentation..."
required_vars=("DB_HOST" "DB_PORT" "REDIS_HOST" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if grep -q "$var" .github/workflows/*.yml; then
        echo "  ✓ $var is used in workflows"
    fi
done
echo ""

echo "✅ Workflow verification complete!"
echo ""
echo "💡 To test workflows locally, consider using:"
echo "   - act: https://github.com/nektos/act"
echo "   - actionlint: https://github.com/rhysd/actionlint"
