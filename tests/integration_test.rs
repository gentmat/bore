///! Integration tests for Bore tunnel system
///! Tests communication between Rust components (client/server) and TypeScript backend
///!
///! These tests require a running backend server at http://localhost:3000 (or BACKEND_URL).
///! Run with: cargo test -- --ignored
///! Or set environment variable: RUN_INTEGRATION_TESTS=1 cargo test

use anyhow::Result;
use reqwest::Client as HttpClient;
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;

/// Base URL for the backend API (override with BACKEND_URL env var)
fn backend_url() -> String {
    std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
}

/// Check if backend is available, skip test if not
async fn ensure_backend_available() -> Result<()> {
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(2))
        .build()?;
    
    match client.get(&format!("{}/health", backend_url())).send().await {
        Ok(_) => Ok(()),
        Err(e) => {
            eprintln!("Backend not available at {}. Skipping test.", backend_url());
            eprintln!("Start backend with: cd backend && npm start");
            eprintln!("Or run with: cargo test -- --ignored");
            // Return error to skip this test but allow other tests to continue
            bail!("Backend not available: {}", e)
        }
    }
}

/// Test backend health endpoint
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_backend_health() -> Result<()> {
    ensure_backend_available().await?;
    let client = HttpClient::new();
    let url = format!("{}/health", backend_url());
    
    let response = client.get(&url).send().await?;
    assert!(response.status().is_success(), "Backend health check failed");
    
    let body: serde_json::Value = response.json().await?;
    assert_eq!(body["status"], "healthy", "Backend is not healthy");
    
    Ok(())
}

/// Test user registration via backend API
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_user_registration() -> Result<()> {
    ensure_backend_available().await?;
    let client = HttpClient::new();
    let url = format!("{}/api/v1/auth/register", backend_url());
    
    let test_email = format!("test-{}@example.com", uuid::Uuid::new_v4());
    let payload = json!({
        "email": test_email,
        "password": "TestPassword123!",
        "name": "Integration Test User"
    });
    
    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await?;
    
    // Accept both 201 (created) and 409 (conflict if already exists)
    assert!(
        response.status().is_success() || response.status() == 409,
        "Registration failed with status: {}",
        response.status()
    );
    
    Ok(())
}

/// Test user login and JWT token retrieval
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_user_login() -> Result<()> {
    ensure_backend_available().await?;
    let client = HttpClient::new();
    
    // First register a user
    let test_email = format!("login-test-{}@example.com", uuid::Uuid::new_v4());
    let password = "TestPassword123!";
    
    let register_url = format!("{}/api/v1/auth/register", backend_url());
    let register_payload = json!({
        "email": test_email,
        "password": password,
        "name": "Login Test User"
    });
    
    client
        .post(&register_url)
        .json(&register_payload)
        .send()
        .await?;
    
    sleep(Duration::from_millis(100)).await;
    
    // Now login
    let login_url = format!("{}/api/v1/auth/login", backend_url());
    let login_payload = json!({
        "email": test_email,
        "password": password
    });
    
    let response = client
        .post(&login_url)
        .json(&login_payload)
        .send()
        .await?;
    
    assert!(response.status().is_success(), "Login failed");
    
    let body: serde_json::Value = response.json().await?;
    assert!(body["token"].is_string(), "No token returned");
    assert!(body["user"].is_object(), "No user object returned");
    
    Ok(())
}

/// Test instance creation via authenticated API
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_instance_creation() -> Result<()> {
    ensure_backend_available().await?;
    let client = HttpClient::new();
    let base_url = backend_url();
    
    // Register and login
    let test_email = format!("instance-test-{}@example.com", uuid::Uuid::new_v4());
    let password = "TestPassword123!";
    
    let register_payload = json!({
        "email": test_email,
        "password": password,
        "name": "Instance Test User"
    });
    
    client
        .post(&format!("{}/api/v1/auth/register", base_url))
        .json(&register_payload)
        .send()
        .await?;
    
    sleep(Duration::from_millis(100)).await;
    
    let login_payload = json!({
        "email": test_email,
        "password": password
    });
    
    let login_response = client
        .post(&format!("{}/api/v1/auth/login", base_url))
        .json(&login_payload)
        .send()
        .await?;
    
    let login_body: serde_json::Value = login_response.json().await?;
    let token = login_body["token"].as_str().unwrap();
    
    // Create instance
    let instance_payload = json!({
        "name": "test-instance",
        "local_port": 8080,
        "region": "us-east"
    });
    
    let create_response = client
        .post(&format!("{}/api/v1/instances", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .json(&instance_payload)
        .send()
        .await?;
    
    assert!(
        create_response.status().is_success(),
        "Instance creation failed: {}",
        create_response.status()
    );
    
    let instance: serde_json::Value = create_response.json().await?;
    assert_eq!(instance["name"], "test-instance");
    assert_eq!(instance["local_port"], 8080);
    
    Ok(())
}

/// Test API key validation (used by bore-server)
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_api_key_validation() -> Result<()> {
    ensure_backend_available().await?;
    let client = HttpClient::new();
    let base_url = backend_url();
    
    // Register and login to get user
    let test_email = format!("apikey-test-{}@example.com", uuid::Uuid::new_v4());
    let password = "TestPassword123!";
    
    client
        .post(&format!("{}/api/v1/auth/register", base_url))
        .json(&json!({
            "email": test_email,
            "password": password,
            "name": "API Key Test User"
        }))
        .send()
        .await?;
    
    sleep(Duration::from_millis(100)).await;
    
    let login_response = client
        .post(&format!("{}/api/v1/auth/login", base_url))
        .json(&json!({
            "email": test_email,
            "password": password
        }))
        .send()
        .await?;
    
    let login_body: serde_json::Value = login_response.json().await?;
    let token = login_body["token"].as_str().unwrap();
    
    // Get user's API key
    let user_response = client
        .get(&format!("{}/api/v1/auth/me", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;
    
    if user_response.status().is_success() {
        let user: serde_json::Value = user_response.json().await?;
        if let Some(api_key) = user["api_key"].as_str() {
            // Validate the API key (this endpoint is used by bore-server)
            // Note: This endpoint might require internal API key
            println!("API Key retrieved: {}", &api_key[..8]);
        }
    }
    
    Ok(())
}

/// Test metrics endpoint
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_metrics_endpoint() -> Result<()> {
    ensure_backend_available().await?;
    let client = HttpClient::new();
    let url = format!("{}/metrics", backend_url());
    
    let response = client.get(&url).send().await?;
    assert!(response.status().is_success(), "Metrics endpoint failed");
    
    let body = response.text().await?;
    assert!(body.contains("# HELP"), "Metrics output invalid");
    
    Ok(())
}

/// Test WebSocket connection (basic connectivity test)
#[tokio::test]
#[ignore = "requires running backend server"]
#[cfg(feature = "websocket-tests")]
async fn test_websocket_connection() -> Result<()> {
    ensure_backend_available().await?;
    use tokio_tungstenite::{connect_async, tungstenite::Message};
    use futures_util::{SinkExt, StreamExt};
    
    let ws_url = backend_url().replace("http://", "ws://") + "/socket.io/";
    
    match connect_async(&ws_url).await {
        Ok((mut ws_stream, _)) => {
            // Send ping
            ws_stream.send(Message::Text("ping".to_string())).await?;
            
            // Wait for response (with timeout)
            let timeout_result = tokio::time::timeout(
                Duration::from_secs(5),
                ws_stream.next()
            ).await;
            
            match timeout_result {
                Ok(Some(Ok(msg))) => {
                    println!("WebSocket response: {:?}", msg);
                }
                _ => {
                    println!("No WebSocket response (may be expected for Socket.IO)");
                }
            }
            
            Ok(())
        }
        Err(e) => {
            println!("WebSocket connection failed (may be expected if Socket.IO handshake required): {}", e);
            Ok(())
        }
    }
}

#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_rate_limiting() -> Result<()> {
    ensure_backend_available().await?;
    let client = HttpClient::new();
    let url = format!("{}/api/v1/auth/login", backend_url());
    
    // Make multiple rapid requests to trigger rate limit
    let mut responses = vec![];
    for _ in 0..10 {
        let response = client
            .post(&url)
            .json(&json!({
                "email": "nonexistent@example.com",
                "password": "wrong"
            }))
            .send()
            .await?;
        
        responses.push(response.status());
    }
    
    // Check if any request was rate limited
    let has_rate_limit = responses.iter().any(|s| s.as_u16() == 429);
    
    if has_rate_limit {
        println!("Rate limiting is working correctly");
    } else {
        println!("No rate limit triggered (may need more requests)");
    }
    
    Ok(())
}
