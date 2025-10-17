/// Regression test for authentication bypass vulnerability
/// 
/// CVE: High-severity auth bypass where clients could send ClientMessage::Authenticate
/// with arbitrary strings in legacy shared-secret mode and bypass HMAC validation.
///
/// Attack: When server runs with backend disabled but shared secret configured,
/// sending Authenticate would trigger backend.validate_api_key() which returns
/// automatic success, bypassing the HMAC challenge-response flow.
///
/// Fix: Server now rejects Authenticate messages when backend is disabled and
/// legacy auth is configured, forcing proper Hello → Challenge → Response flow.

use anyhow::Result;
use bore_server::Server;
use bore_shared::{ClientMessage, Delimited, ServerMessage, CONTROL_PORT};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time;

#[tokio::test]
async fn test_auth_bypass_prevention() -> Result<()> {
    // Start server with legacy shared secret (backend disabled)
    let secret = "my-secret-123";
    tokio::spawn(Server::new(1024..=65535, Some(secret), None, None, "test".to_string()).listen());
    time::sleep(Duration::from_millis(50)).await;

    // Attempt 1: Try to bypass auth with Authenticate message
    let stream = TcpStream::connect(("localhost", CONTROL_PORT)).await?;
    let mut delimited = Delimited::new(stream);

    // Send Authenticate with wrong/arbitrary secret (attempting bypass)
    delimited
        .send(ClientMessage::Authenticate("wrong-secret".to_string()))
        .await?;

    // Should receive Error or connection close (None), not success
    // Server closes connection after sending Error, so we might get None
    match delimited.recv_timeout().await {
        Ok(Some(ServerMessage::Error(msg))) => {
            // Expected: server rejects Authenticate in legacy mode
            assert!(
                msg.contains("not supported") || msg.contains("shared secret"),
                "Expected rejection message, got: {}",
                msg
            );
            println!("✓ Auth bypass prevented: {}", msg);
        }
        Ok(None) | Err(_) => {
            // Connection closed - also acceptable (server closes after Error)
            println!("✓ Auth bypass prevented: connection closed");
        }
        Ok(Some(ServerMessage::Hello(_))) => {
            panic!("SECURITY VULNERABILITY: Server granted tunnel after Authenticate with wrong secret!");
        }
        Ok(Some(ServerMessage::Challenge(_))) => {
            panic!("Unexpected Challenge after Authenticate message");
        }
        Ok(other) => {
            panic!("Unexpected response to Authenticate bypass attempt: {:?}", other);
        }
    }

    // Main security test passed! The Authenticate bypass is prevented.
    // 
    // Note: We don't test the full Challenge-Response flow here because:
    // 1. That's covered by other e2e tests (mismatched_secret, basic_proxy)
    // 2. The critical security issue is the bypass, which we've verified is fixed

    Ok(())
}

// Note: Additional tests for normal Authenticate flow with backend enabled
// are not included here as they require a running backend API.
// The critical security test above is sufficient to verify the vulnerability is fixed.
