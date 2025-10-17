# Integration Tests

⚠️ **CRITICAL COVERAGE GAP**: All integration tests are currently empty stubs marked with `#[ignore]`. Given the recent protocol changes, authentication refactoring, and security fixes, automated integration test coverage is essential to prevent regressions.

This directory contains end-to-end integration tests that verify the entire system works correctly across all components.

## Priority Test Cases (Currently Missing)

### Authentication & Security
- [ ] **Legacy HMAC flow**: Verify Challenge → Response → Hello with shared secret
- [ ] **Modern API key auth**: Test sk_ prefixed key with Authenticate → Hello
- [ ] **Tunnel token auth**: Test tk_ prefixed tokens from backend
- [ ] **Auth bypass prevention**: Ensure Authenticate is rejected in legacy mode
- [ ] **Expired token rejection**: Verify expired tokens are properly denied
- [ ] **Plan expiry enforcement**: Test that expired plans cannot create/use tunnels

### End-to-End Flows  
- [ ] **Complete lifecycle**: Register → Create instance → Connect tunnel → Traffic → Cleanup
- [ ] **Concurrent tunnels**: Verify plan limits and port isolation
- [ ] **Tunnel reconnection**: Test reconnect with same token
- [ ] **Heartbeat maintenance**: Verify heartbeats keep connection alive

### API Compatibility
- [ ] **Connection info response**: Verify TTL field is present and correct
- [ ] **Instance creation**: Test all fields and response format
- [ ] **Plan quota enforcement**: Test tunnel creation limits by plan type

## Test Structure

```
tests/integration/
├── README.md                    # This file
├── test_full_flow.rs           # Complete client-server-backend flow (STUB)
├── test_api_compatibility.rs   # API contract tests
├── test_auth_flows.rs          # All authentication scenarios (STUB)
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
