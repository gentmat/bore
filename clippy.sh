#!/bin/bash
# Run Clippy with comprehensive checks on all Rust code

set -e

echo "🔍 Running Clippy checks on Rust workspace..."
echo ""

# Run clippy with strict checks
cargo clippy --all-targets --all-features -- \
  -D warnings \
  -W clippy::all \
  -W clippy::pedantic \
  -W clippy::nursery \
  -A clippy::module_name_repetitions \
  -A clippy::missing_errors_doc \
  -A clippy::missing_panics_doc

echo ""
echo "✅ Clippy checks passed!"
