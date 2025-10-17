# Integration Tests

✅ **COVERAGE RESTORED**: Integration tests are now fully implemented with mock backend and test harnesses. These tests run without external dependencies and can execute in CI.

This directory contains end-to-end integration tests that verify the entire system works correctly across all components.

## Implemented Test Cases

### Authentication & Security
- ✅ **Legacy HMAC flow**: Verify Challenge → Response → Hello with shared secret
- ✅ **Modern API key auth**: Test sk_ prefixed key with Authenticate → Hello
- ✅ **Tunnel token auth**: Test tk_ prefixed tokens from backend
- ✅ **Auth bypass prevention**: Ensure Authenticate is rejected in legacy mode
- ✅ **Expired token rejection**: Verify expired tokens are properly denied

### End-to-End Flows  
- ✅ **Complete lifecycle**: Register → Create instance → Connect tunnel → Traffic → Cleanup
- ✅ **Concurrent tunnels**: Verify port uniqueness and traffic isolation
- ✅ **Tunnel reconnection**: Test reconnect with same token
- ✅ **Heartbeat maintenance**: Verify heartbeats keep connection alive

## Test Structure

```
tests/integration/
├── README.md                    # This file
├── test_full_flow.rs           # Complete client-server-backend flow (IMPLEMENTED)
├── test_auth_flows.rs          # All authentication scenarios (IMPLEMENTED)
└── fixtures/                   # Test harnesses and mocks
    ├── mod.rs
    ├── test_helpers.rs         # Common test utilities
    └── mock_backend.rs         # Mock backend server for testing
```

## Running Integration Tests

### Running Without External Dependencies

The integration tests now use mock backend servers and test harnesses, so they can run without any external services:

```bash
# Run all integration tests
cargo test --test test_auth_flows
cargo test --test test_full_flow

# Run specific test
cargo test --test test_auth_flows test_legacy_hmac_authentication

# Run with output
cargo test --test test_full_flow -- --nocapture
```

### Running with Live Services (Optional)

If you want to test against real backend and bore-server instances:

1. Start the backend server:
   ```bash
   cd backend && npm start
   ```

2. Start a bore-server instance:
   ```bash
   cargo run --bin bore-server
   ```

3. Run the ignored tests:
   ```bash
   cargo test -- --ignored
   ```

## Test Architecture

### Mock Backend
The `mock_backend.rs` fixture provides a lightweight HTTP server that simulates the TypeScript backend:
- User registration and API key management
- Tunnel token creation and validation
- API key validation endpoints
- Token expiration handling

### Test Helpers
The `test_helpers.rs` module provides:
- Port allocation for test servers
- Server spawning utilities
- Common test patterns

### Writing New Tests

Integration tests should:
1. Use mock backend for fast, reliable testing
2. Test real network connections between components
3. Verify data flows through all layers
4. Use serial test guard to prevent port conflicts
5. Clean up resources properly

Example:
```rust
#[tokio::test]
async fn test_new_feature() -> Result<()> {
    let _guard = SERIAL_GUARD.lock().await;
    
    // Setup mock backend
    let backend = MockBackend::new(find_available_port()?);
    // ... test implementation
    
    Ok(())
}
```
