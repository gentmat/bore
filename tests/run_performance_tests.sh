#!/bin/bash

# Bore Performance Test Runner
# Runs comprehensive performance benchmarks and regression tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="${PROJECT_ROOT}/performance_results"
BASELINE_FILE="${RESULTS_DIR}/baseline.json"
REPORT_FILE="${RESULTS_DIR}/performance_report.md"

# Create results directory
mkdir -p "$RESULTS_DIR"

# Functions
print_header() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}"
}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check system prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check Rust toolchain
    if ! command -v cargo > /dev/null 2>&1; then
        print_error "Rust/Cargo is required"
        exit 1
    fi

    # Check if criterion is available
    if ! cargo list --format=plain 2>/dev/null | grep -q criterion; then
        print_status "Installing criterion benchmarking library..."
        cargo add criterion --dev --features html_reports 2>/dev/null || true
    fi

    # Check system resources
    local available_memory
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        available_memory=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//' | awk '{printf "%.0f", $1 * 4096 / 1024 / 1024}')
    else
        available_memory=0
    fi

    if [ "$available_memory" -lt 512 ]; then
        print_warning "Low available memory (${available_memory}MB). Performance tests may be slow."
    fi

    print_status "System check completed"
}

# Run criterion benchmarks
run_criterion_benchmarks() {
    print_header "Running Criterion Benchmarks"

    local benchmark_dir="${RESULTS_DIR}/criterion"
    mkdir -p "$benchmark_dir"

    print_status "Running tunnel establishment benchmarks..."
    cargo bench --bench performance_benchmarks tunnel_establishment -- --output-format html

    print_status "Running throughput benchmarks..."
    cargo bench --bench performance_benchmarks throughput -- --output-format html

    print_status "Running concurrent connection benchmarks..."
    cargo bench --bench performance_benchmarks concurrent_connections -- --output-format html

    print_status "Running memory usage benchmarks..."
    cargo bench --bench performance_benchmarks memory_usage -- --output-format html

    # Move HTML reports to results directory
    if [ -d "target/criterion" ]; then
        mv target/criterion/* "$benchmark_dir/" 2>/dev/null || true
    fi

    print_status "Criterion benchmarks completed"
}

# Run regression tests
run_regression_tests() {
    print_header "Running Performance Regression Tests"

    if [ "$1" = "--update-baseline" ]; then
        print_status "Establishing new performance baseline..."
        BASELINE_RUN=true cargo test --release --test performance_benchmarks performance_regression_test -- --ignored --nocapture
        print_status "New baseline established"
    else
        print_status "Testing against existing baseline..."

        if cargo test --release --test performance_benchmarks performance_regression_test -- --ignored --nocapture; then
            print_status "✅ No performance regressions detected"
        else
            print_error "❌ Performance regressions detected!"
            return 1
        fi
    fi
}

# Run stress tests
run_stress_tests() {
    print_header "Running Stress Tests"

    print_status "Running memory leak stress test..."
    if cargo test --release --test performance_benchmarks memory_leak_stress_test -- --ignored --nocapture; then
        print_status "✅ Memory leak test passed"
    else
        print_error "❌ Memory leak test failed"
        return 1
    fi

    print_status "Running stability test..."
    if cargo test --release --test performance_benchmarks stability_test -- --ignored --nocapture; then
        print_status "✅ Stability test passed"
    else
        print_error "❌ Stability test failed"
        return 1
    fi
}

# Generate performance report
generate_report() {
    print_header "Generating Performance Report"

    local report_date=$(date '+%Y-%m-%d %H:%M:%S')
    local git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

    cat > "$REPORT_FILE" << EOF
# Bore Performance Report

**Generated:** $report_date
**Git Commit:** $git_commit ($git_branch)
**Rust Version:** $(rustc --version)

## Executive Summary

This report contains comprehensive performance metrics for the Bore tunneling system.

## Test Results

### Benchmark Results

EOF

    # Add criterion benchmark results
    if [ -f "target/criterion/tunnel_establishment/report/index.html" ]; then
        echo "#### Tunnel Establishment" >> "$REPORT_FILE"
        echo "- View detailed results: \`criterion/tunnel_establishment/report/index.html\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi

    # Add system information
    cat >> "$REPORT_FILE" << EOF
### System Information

- **OS:** $(uname -s) $(uname -r)
- **CPU:** $(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Unknown")
- **Memory:** $(free -h 2>/dev/null | grep '^Mem:' | awk '{print $2}' || echo "Unknown")

### Test Configuration

- **Test Data Sizes:**
  - Small: 1KB
  - Medium: 1MB
  - Large: 10MB
- **Concurrent Connections:** 1, 10, 50, 100
- **Test Duration:** Variable (per test)

## Recommendations

1. Monitor tunnel establishment times for regressions
2. Track throughput under different load conditions
3. Profile memory usage during high concurrency
4. Set up automated performance testing in CI/CD

## Historical Data

Performance history is tracked in the \`performance_results\` directory.

EOF

    print_status "Performance report generated: $REPORT_FILE"
}

# Compare with previous results
compare_with_previous() {
    print_header "Comparing with Previous Results"

    if [ -f "$BASELINE_FILE" ]; then
        print_status "Found baseline performance data"

        # Extract key metrics from baseline (simplified)
        if command -v jq > /dev/null 2>&1; then
            local baseline_throughput=$(jq -r '.throughput_mbps // "N/A"' "$BASELINE_FILE" 2>/dev/null || echo "N/A")
            local baseline_establishment=$(jq -r '.tunnel_establishment_ms // "N/A"' "$BASELINE_FILE" 2>/dev/null || echo "N/A")

            print_status "Baseline metrics:"
            print_status "  Throughput: ${baseline_throughput} Mbps"
            print_status "  Establishment: ${baseline_establishment} ms"
        fi
    else
        print_warning "No baseline found. Run with --update-baseline to create one."
    fi
}

# Main execution
main() {
    cd "$PROJECT_ROOT"

    print_header "Bore Performance Test Suite"
    print_status "Results directory: $RESULTS_DIR"

    # Parse arguments
    local update_baseline=false
    local run_stress=false
    local run_criterion=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --update-baseline)
                update_baseline=true
                shift
                ;;
            --stress)
                run_stress=true
                shift
                ;;
            --criterion)
                run_criterion=true
                shift
                ;;
            --all)
                run_stress=true
                run_criterion=true
                shift
                ;;
            --help)
                echo "Bore Performance Test Runner"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --update-baseline    Establish new performance baseline"
                echo "  --stress            Run stress tests"
                echo "  --criterion         Run criterion benchmarks"
                echo "  --all               Run all performance tests"
                echo "  --help              Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 --update-baseline    # Create new baseline"
                echo "  $0 --all                # Run all tests"
                echo "  $0                      # Run regression tests only"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Default behavior: run regression tests
    if [ "$run_stress" = false ] && [ "$run_criterion" = false ] && [ "$update_baseline" = false ]; then
        run_stress=true
        run_criterion=true
    fi

    # Check prerequisites
    check_prerequisites

    # Compare with previous results
    compare_with_previous

    local test_start_time=$(date +%s)
    local failed_tests=0

    # Run tests based on arguments
    if [ "$run_criterion" = true ]; then
        if ! run_criterion_benchmarks; then
            failed_tests=$((failed_tests + 1))
        fi
    fi

    if [ "$update_baseline" = true ]; then
        if ! run_regression_tests --update-baseline; then
            failed_tests=$((failed_tests + 1))
        fi
    else
        if ! run_regression_tests; then
            failed_tests=$((failed_tests + 1))
        fi
    fi

    if [ "$run_stress" = true ]; then
        if ! run_stress_tests; then
            failed_tests=$((failed_tests + 1))
        fi
    fi

    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - test_start_time))

    # Generate report
    generate_report

    # Print summary
    print_header "Performance Test Summary"
    print_status "Total duration: ${test_duration}s"
    print_status "Results location: $RESULTS_DIR"

    if [ $failed_tests -eq 0 ]; then
        print_status "🎉 All performance tests passed!"
        print_status "View detailed results: $REPORT_FILE"
        exit 0
    else
        print_error "💥 $failed_tests test(s) failed"
        print_error "Review the logs above for details"
        exit 1
    fi
}

# Show help if no arguments
if [ $# -eq 0 ]; then
    echo "Bore Performance Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Run '$0 --help' for detailed usage information"
    echo ""
    echo "Quick start:"
    echo "  $0 --all                # Run all performance tests"
    echo "  $0 --update-baseline    # Create new baseline"
    exit 0
fi

# Execute main function
main "$@"