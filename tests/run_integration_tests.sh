#!/bin/bash

# Bore Integration Test Runner
# Runs comprehensive integration tests for the full tunnel flow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
TEST_TIMEOUT="${TEST_TIMEOUT:-300}" # 5 minutes default

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

# Check if services are running
check_service() {
    local service_url=$1
    local service_name=$2

    if curl -f -s --max-time 5 "$service_url/health" > /dev/null 2>&1; then
        print_status "$service_name is running"
        return 0
    else
        print_warning "$service_name is not running at $service_url"
        return 1
    fi
}

# Start backend if not running
start_backend() {
    if ! check_service "http://localhost:3000" "Backend"; then
        print_status "Starting backend server..."
        cd "$BACKEND_DIR"

        # Ensure dependencies are installed
        if [ ! -d "node_modules" ]; then
            print_status "Installing backend dependencies..."
            npm install
        fi

        # Ensure database is migrated
        npm run migrate:up > /dev/null 2>&1 || true

        # Start backend in background
        npm start > backend.log 2>&1 &
        BACKEND_PID=$!

        # Wait for backend to be ready
        local max_wait=30
        local wait_time=0
        while [ $wait_time -lt $max_wait ]; do
            if check_service "http://localhost:3000" "Backend"; then
                break
            fi
            sleep 1
            wait_time=$((wait_time + 1))
        done

        if [ $wait_time -eq $max_wait ]; then
            print_error "Backend failed to start within $max_wait seconds"
            print_error "Check logs: $BACKEND_DIR/backend.log"
            exit 1
        fi

        print_status "Backend started successfully (PID: $BACKEND_PID)"
    fi
}

# Start bore-server if not running
start_bore_server() {
    if ! nc -z localhost 7835 2>/dev/null; then
        print_status "Starting bore-server..."
        cd "$PROJECT_ROOT"

        # Build if needed
        if [ ! -f "target/release/bore-server" ]; then
            print_status "Building bore-server..."
            cargo build --release --bin bore-server
        fi

        # Start bore-server in background
        ./target/release/bore-server \
            --bind-addr 127.0.0.1 \
            --backend-url http://localhost:3000 \
            --server-id test-server \
            > bore-server.log 2>&1 &
        BORE_SERVER_PID=$!

        # Wait for server to be ready
        sleep 3

        if nc -z localhost 7835 2>/dev/null; then
            print_status "bore-server started successfully (PID: $BORE_SERVER_PID)"
        else
            print_warning "bore-server may not be ready (check logs)"
        fi
    fi
}

# Cleanup function
cleanup() {
    print_status "Cleaning up test environment..."

    # Stop services if we started them
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        print_status "Stopped backend server"
    fi

    if [ -n "$BORE_SERVER_PID" ]; then
        kill $BORE_SERVER_PID 2>/dev/null || true
        print_status "Stopped bore-server"
    fi

    # Clean up any test containers
    docker-compose -f "$BACKEND_DIR/docker-compose.yml" down 2>/dev/null || true
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Main execution
main() {
    print_header "Bore Integration Tests"

    cd "$PROJECT_ROOT"

    # Check prerequisites
    print_status "Checking prerequisites..."

    if ! command -v cargo > /dev/null 2>&1; then
        print_error "Rust/Cargo is required"
        exit 1
    fi

    if ! command -v node > /dev/null 2>&1; then
        print_error "Node.js is required"
        exit 1
    fi

    # Check if we want to use Docker services
    if [ "$1" = "--docker" ]; then
        print_status "Using Docker services..."
        cd "$BACKEND_DIR"

        # Start Docker services
        docker-compose --profile monitoring up -d

        # Wait for services
        print_status "Waiting for Docker services..."
        sleep 10

        # Check if backend is ready
        local max_wait=60
        local wait_time=0
        while [ $wait_time -lt $max_wait ]; do
            if check_service "http://localhost:3000" "Backend"; then
                break
            fi
            sleep 2
            wait_time=$((wait_time + 2))
        done

        if [ $wait_time -eq $max_wait ]; then
            print_error "Docker backend failed to start"
            docker-compose logs backend
            exit 1
        fi

        BORE_SERVER_RUNNING=true
    else
        # Start services locally
        start_backend
        start_bore_server
    fi

    # Set test environment variables
    export BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
    export BORE_SERVER="${BORE_SERVER:-127.0.0.1:7835}"
    export RUST_LOG="${RUST_LOG:-debug}"
    export RUN_INTEGRATION_TESTS=1

    print_status "Test configuration:"
    print_status "  Backend URL: $BACKEND_URL"
    print_status "  Bore Server: $BORE_SERVER"
    print_status "  Test Timeout: ${TEST_TIMEOUT}s"
    print_status ""

    # Run the tests
    print_header "Running Integration Tests"

    local test_start_time=$(date +%s)
    local failed_tests=0
    local total_tests=0

    # List of integration tests to run
    local tests=(
        "full_tunnel_integration_test::test_full_tunnel_flow_basic_setup"
        "full_tunnel_integration_test::test_instance_lifecycle"
        "full_tunnel_integration_test::test_error_handling"
        "full_tunnel_integration_test::test_metrics_during_operations"
        "full_tunnel_integration_test::test_tcp_tunnel_connection"
        "full_tunnel_integration_test::test_tunnel_data_transmission"
        "full_tunnel_integration_test::test_concurrent_tunnels"
        "full_tunnel_integration_test::test_tunnel_reconnection"
        "full_tunnel_integration_test::benchmark_tunnel_establishment"
    )

    for test in "${tests[@]}"; do
        print_status "Running: $test"

        total_tests=$((total_tests + 1))

        if timeout $TEST_TIMEOUT cargo test "$test" -- --ignored --nocapture; then
            print_status "✅ PASSED: $test"
        else
            print_error "❌ FAILED: $test"
            failed_tests=$((failed_tests + 1))

            # Ask user if they want to continue
            if [ "$1" != "--force" ]; then
                read -p "Continue with remaining tests? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    print_status "Stopping test execution"
                    break
                fi
            fi
        fi

        echo ""
    done

    # Calculate test duration
    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - test_start_time))

    # Print summary
    print_header "Test Results Summary"
    print_status "Total tests: $total_tests"
    print_status "Passed: $((total_tests - failed_tests))"
    print_status "Failed: $failed_tests"
    print_status "Duration: ${test_duration}s"

    if [ $failed_tests -eq 0 ]; then
        print_status "🎉 All integration tests passed!"
        exit_code=0
    else
        print_error "💥 $failed_tests test(s) failed"
        exit_code=1
    fi

    # Show logs if there were failures
    if [ $failed_tests -gt 0 ]; then
        echo ""
        print_status "Recent logs:"

        if [ -f "$BACKEND_DIR/backend.log" ]; then
            echo "=== Backend Log ==="
            tail -20 "$BACKEND_DIR/backend.log"
            echo ""
        fi

        if [ -f "$PROJECT_ROOT/bore-server.log" ]; then
            echo "=== Bore Server Log ==="
            tail -20 "$PROJECT_ROOT/bore-server.log"
            echo ""
        fi
    fi

    return $exit_code
}

# Help function
show_help() {
    echo "Bore Integration Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --docker     Use Docker services instead of local"
    echo "  --force      Continue running tests even after failures"
    echo "  --help       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKEND_URL      Backend server URL (default: http://localhost:3000)"
    echo "  BORE_SERVER      Bore server address (default: 127.0.0.1:7835)"
    echo "  TEST_TIMEOUT     Test timeout in seconds (default: 300)"
    echo "  RUST_LOG         Rust log level (default: debug)"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run tests with local services"
    echo "  $0 --docker                  # Run tests with Docker services"
    echo "  $0 --force                   # Run all tests without stopping on failure"
    echo "  BACKEND_URL=http://localhost:4000 $0  # Use custom backend URL"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac