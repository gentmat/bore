# Integration Tests

This directory contains end-to-end integration tests that verify the entire system works correctly across all components.

## Test Structure

```
tests/integration/
├── README.md                    # This file
├── test_full_flow.rs           # Complete client-server-backend flow
├── test_api_compatibility.rs   # API contract tests
├── test_auth_flows.rs          # All authentication scenarios
└── fixtures/                   # Test data and helpers
    ├── mod.rs
    └── test_helpers.rs
```

## Running Integration Tests

### Prerequisites
1. Start the backend server:
   ```bash
   cd backend && npm start
   ```

2. Start a bore-server instance:
   ```bash
   cargo run --bin bore-server
   ```

3. Run the tests:
   ```bash
   cargo test --test integration --features integration-tests
   ```

### Environment Variables
- `BACKEND_URL`: Backend API URL (default: `http://localhost:3000`)
- `BORE_SERVER_HOST`: Bore server host (default: `localhost`)
- `BORE_SERVER_PORT`: Bore server port (default: `7835`)

## Writing New Tests

Integration tests should:
1. Test real end-to-end scenarios
2. Use actual network connections
3. Verify data flows through all layers
4. Check error handling across components
5. Be tagged with `#[ignore]` by default (run with `--ignored`)

Example:
```rust
#[tokio::test]
#[ignore = "requires running backend and bore-server"]
async fn test_complete_tunnel_lifecycle() {
    // Test implementation
}
```
