/// Test helper utilities for integration tests
use anyhow::Result;
use bore_server::Server;
use std::net::TcpListener;
use std::time::Duration;
use tokio::time::sleep;

/// Find an available TCP port
pub fn find_available_port() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

/// Spawn a test bore-server with given configuration
pub async fn spawn_test_server(secret: Option<&str>, backend_url: Option<&str>) -> Result<()> {
    let server = Server::new(
        10000..=60000,
        secret,
        backend_url.map(|s| s.to_string()),
        None,
        "test-server".to_string(),
    );

    tokio::spawn(async move {
        // Ignore errors since we expect the server to be killed between tests
        let _ = server.listen().await;
    });

    // Give server time to start
    sleep(Duration::from_millis(300)).await;
    Ok(())
}

/// Generate a test API key (simulates backend-generated key)
#[allow(dead_code)]
pub fn generate_test_api_key() -> String {
    format!("sk_test_{}", uuid::Uuid::new_v4().simple())
}

/// Generate a test tunnel token (simulates backend-generated token)
#[allow(dead_code)]
pub fn generate_test_tunnel_token() -> String {
    format!("tk_test_{}", uuid::Uuid::new_v4().simple())
}
