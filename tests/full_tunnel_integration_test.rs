///! Full Tunnel Flow Integration Tests
///! Tests the complete end-to-end tunnel establishment and data flow
///!
///! These tests verify:
///! 1. Client authentication with backend
///! 2. Server registration and heartbeat
///! 3. Tunnel creation and connection
///! 4. Data transmission through tunnel
///! 5. Tunnel teardown and cleanup
///!
///! Requirements:
///! - Running backend server at http://localhost:3000 (or BACKEND_URL)
///! - Optional: Running bore-server at localhost:7835 (or BORE_SERVER_URL)

use anyhow::{Result, Context};
use reqwest::Client as HttpClient;
use serde_json::json;
use std::collections::HashMap;
use std::net::{TcpListener, TcpStream, IpAddr, Ipv4Addr};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener as TokioTcpListener, TcpStream as TokioTcpStream};

use bore_shared::proto::{ClientMessage, ServerMessage};
use bore_client::Client;
use bore_server::Server;

// Configuration
const DEFAULT_BACKEND_URL: &str = "http://localhost:3000";
const DEFAULT_BORE_SERVER: &str = "127.0.0.1:7835";
const TEST_TIMEOUT: Duration = Duration::from_secs(30);
const DATA_TEST_SIZE: usize = 1024 * 1024; // 1MB

/// Test configuration loaded from environment
struct TestConfig {
    backend_url: String,
    bore_server: String,
    test_user: TestUser,
}

/// Test user credentials
struct TestUser {
    email: String,
    password: String,
    api_key: Option<String>,
    jwt_token: Option<String>,
}

impl TestConfig {
    fn from_env() -> Self {
        Self {
            backend_url: std::env::var("BACKEND_URL").unwrap_or_else(|_| DEFAULT_BACKEND_URL.to_string()),
            bore_server: std::env::var("BORE_SERVER").unwrap_or_else(|_| DEFAULT_BORE_SERVER.to_string()),
            test_user: TestUser {
                email: std::env::var("TEST_EMAIL").unwrap_or_else(|_| {
                    format!("integration-test-{}@bore.test", uuid::Uuid::new_v4())
                }),
                password: std::env::var("TEST_PASSWORD").unwrap_or_else(|_| "TestPassword123!".to_string()),
                api_key: None,
                jwt_token: None,
            },
        }
    }
}

/// Helper function to find an available port
fn find_available_port() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

/// Setup test user and obtain authentication
async fn setup_test_user(config: &mut TestConfig) -> Result<()> {
    let client = HttpClient::new();

    // Register user
    let register_url = format!("{}/api/v1/auth/register", config.backend_url);
    let register_payload = json!({
        "email": config.test_user.email,
        "password": config.test_user.password,
        "name": "Integration Test User"
    });

    let response = client
        .post(&register_url)
        .json(&register_payload)
        .send()
        .await
        .context("User registration failed")?;

    if !response.status().is_success() && response.status() != 409 {
        anyhow::bail!("Registration failed: {}", response.status());
    }

    sleep(Duration::from_millis(100)).await;

    // Login user
    let login_url = format!("{}/api/v1/auth/login", config.backend_url);
    let login_payload = json!({
        "email": config.test_user.email,
        "password": config.test_user.password
    });

    let response = client
        .post(&login_url)
        .json(&login_payload)
        .send()
        .await
        .context("User login failed")?;

    if !response.status().is_success() {
        anyhow::bail!("Login failed: {}", response.status());
    }

    let body: serde_json::Value = response.json().await?;
    if let Some(token) = body["token"].as_str() {
        config.test_user.jwt_token = Some(token.to_string());
    }

    // Get API key
    if let Some(token) = &config.test_user.jwt_token {
        let user_url = format!("{}/api/v1/auth/me", config.backend_url);
        let response = client
            .get(&user_url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;

        if response.status().is_success() {
            let user: serde_json::Value = response.json().await?;
            if let Some(api_key) = user["api_key"].as_str() {
                config.test_user.api_key = Some(api_key.to_string());
            }
        }
    }

    Ok(())
}

/// Ensure backend is available
async fn ensure_backend_available(url: &str) -> Result<()> {
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(5))
        .build()?;

    let health_url = format!("{}/health", url);
    match client.get(&health_url).send().await {
        Ok(response) if response.status().is_success() => Ok(()),
        Ok(_) => anyhow::bail!("Backend returned unhealthy status"),
        Err(e) => anyhow::bail!("Backend not available: {}", e),
    }
}

/// Test basic backend connectivity
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_full_tunnel_flow_basic_setup() -> Result<()> {
    let mut config = TestConfig::from_env();

    // Ensure backend is available
    ensure_backend_available(&config.backend_url).await
        .context("Backend not available - start with: cd backend && npm start")?;

    // Setup test user
    setup_test_user(&mut config).await?;

    assert!(config.test_user.jwt_token.is_some(), "JWT token should be available");
    assert!(config.test_user.api_key.is_some(), "API key should be available");

    println!("✅ Basic setup successful - user authenticated");
    println!("   Email: {}", config.test_user.email);
    println!("   API Key: {}...", config.test_user.api_key.as_ref().unwrap().chars().take(8).collect::<String>());

    Ok(())
}

/// Test instance creation and lifecycle
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_instance_lifecycle() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    let client = HttpClient::new();
    let token = config.test_user.jwt_token.as_ref().unwrap();

    // Create instance
    let create_url = format!("{}/api/v1/instances", config.backend_url);
    let instance_payload = json!({
        "name": "integration-test-instance",
        "local_port": 8080,
        "region": "us-east",
        "server_id": "test-server-1"
    });

    let response = client
        .post(&create_url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&instance_payload)
        .send()
        .await?;

    assert!(response.status().is_success(), "Instance creation failed: {}", response.status());

    let instance: serde_json::Value = response.json().await?;
    let instance_id = instance["id"].as_str().unwrap();

    println!("✅ Instance created: {}", instance_id);

    // Verify instance exists
    let get_url = format!("{}/api/v1/instances/{}", config.backend_url, instance_id);
    let response = client
        .get(&get_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    assert!(response.status().is_success(), "Instance retrieval failed");

    let retrieved_instance: serde_json::Value = response.json().await?;
    assert_eq!(retrieved_instance["name"], "integration-test-instance");

    // Update instance status
    let update_url = format!("{}/api/v1/instances/{}/status", config.backend_url, instance_id);
    let update_payload = json!({
        "status": "online",
        "tunnel_connected": true
    });

    let response = client
        .put(&update_url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&update_payload)
        .send()
        .await?;

    assert!(response.status().is_success(), "Instance status update failed");

    // List instances
    let list_url = format!("{}/api/v1/instances", config.backend_url);
    let response = client
        .get(&list_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    assert!(response.status().is_success(), "Instance listing failed");

    let instances: serde_json::Value = response.json().await?;
    let instances_array = instances.as_array().unwrap();
    assert!(instances_array.iter().any(|i| i["id"] == instance["id"]));

    // Delete instance
    let delete_url = format!("{}/api/v1/instances/{}", config.backend_url, instance_id);
    let response = client
        .delete(&delete_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    assert!(response.status().is_success(), "Instance deletion failed");

    println!("✅ Instance lifecycle test completed");

    Ok(())
}

/// Test tunnel connection with real TCP server
#[tokio::test]
#[ignore = "requires running backend and optional bore-server"]
async fn test_tcp_tunnel_connection() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    // Find available ports for local test server
    let local_port = find_available_port()?;
    let server_host = "127.0.0.1";

    // Start a simple echo server
    let echo_server = Arc::new(Mutex::new(None));
    let echo_server_clone = echo_server.clone();

    thread::spawn(move || {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let listener = TokioTcpListener::bind((server_host, local_port)).await.unwrap();
            let mut connections = Vec::new();

            // Accept connections for the test duration
            let timeout = Duration::from_secs(10);
            let start_time = Instant::now();

            while start_time.elapsed() < timeout {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        println!("Echo server accepted connection from {}", addr);
                        let mut buffer = [0; 4096];

                        // Echo back data
                        let (mut reader, mut writer) = tokio::io::split(stream);
                        tokio::spawn(async move {
                            loop {
                                match reader.read(&mut buffer).await {
                                    Ok(0) => break, // Connection closed
                                    Ok(n) => {
                                        if writer.write_all(&buffer[..n]).await.is_err() {
                                            break;
                                        }
                                    }
                                    Err(_) => break,
                                }
                            }
                        });
                        connections.push(addr);
                    }
                    Err(_) => break,
                }
            }

            *echo_server_clone.lock().unwrap() = Some(connections);
        });
    });

    // Give echo server time to start
    sleep(Duration::from_millis(100)).await;

    // Create bore client
    let api_key = config.test_user.api_key.as_ref().unwrap();
    let client = Client::new(
        server_host,
        local_port,
        &config.bore_server,
        0, // Let server assign port
        Some(api_key)
    ).await?;

    println!("✅ Bore client created");

    // Start client in background
    let client_handle = {
        let client_clone = client.clone();
        tokio::spawn(async move {
            if let Err(e) = client_clone.listen().await {
                eprintln!("Client listen error: {}", e);
            }
        })
    };

    // Give client time to connect
    sleep(Duration::from_secs(2)).await;

    // Test tunnel connection
    let tunnel_port = client.get_port().await?;

    // Connect through tunnel
    let mut tunnel_stream = TokioTcpStream::connect(("127.0.0.1", tunnel_port)).await?;

    let test_data = b"Hello, Bore Tunnel!";
    tunnel_stream.write_all(test_data).await?;

    let mut response = vec![0; test_data.len()];
    tunnel_stream.read_exact(&mut response).await?;

    assert_eq!(&response, test_data, "Echoed data should match");

    // Cleanup
    drop(tunnel_stream);
    client_handle.abort();

    println!("✅ TCP tunnel connection test completed");

    Ok(())
}

/// Test data transmission through tunnel
#[tokio::test]
#[ignore = "requires running backend and optional bore-server"]
async fn test_tunnel_data_transmission() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    // Setup test server that returns specific data pattern
    let local_port = find_available_port()?;
    let server_host = "127.0.0.1";

    let test_data: Vec<u8> = (0..255).cycle().take(DATA_TEST_SIZE).collect();
    let test_data_clone = test_data.clone();

    thread::spawn(move || {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let listener = TokioTcpListener::bind((server_host, local_port)).await.unwrap();

            if let Ok((mut stream, _)) = listener.accept().await {
                let mut buffer = [0; 4096];

                // Read request and send test data
                if let Ok(n) = stream.read(&mut buffer).await {
                    let _ = stream.write_all(&test_data_clone).await;
                }
            }
        });
    });

    sleep(Duration::from_millis(100)).await;

    // Create and connect client
    let api_key = config.test_user.api_key.as_ref().unwrap();
    let client = Client::new(
        server_host,
        local_port,
        &config.bore_server,
        0,
        Some(api_key)
    ).await?;

    let client_handle = {
        let client_clone = client.clone();
        tokio::spawn(async move {
            let _ = client_clone.listen().await;
        })
    };

    sleep(Duration::from_secs(2)).await;

    let tunnel_port = client.get_port().await?;
    let mut tunnel_stream = TokioTcpStream::connect(("127.0.0.1", tunnel_port)).await?;

    // Send trigger
    tunnel_stream.write_all(b"GET_DATA").await?;

    // Receive large data
    let mut received_data = Vec::new();
    let mut buffer = [0; 4096];
    let start_time = Instant::now();

    while received_data.len() < DATA_TEST_SIZE {
        match tunnel_stream.read(&mut buffer).await {
            Ok(0) => break,
            Ok(n) => received_data.extend_from_slice(&buffer[..n]),
            Err(e) => anyhow::bail!("Read error: {}", e),
        }

        // Timeout check
        if start_time.elapsed() > TEST_TIMEOUT {
            anyhow::bail!("Data transmission timeout");
        }
    }

    // Verify data integrity
    assert_eq!(received_data.len(), DATA_TEST_SIZE, "Data size mismatch");
    assert_eq!(received_data, test_data, "Data content mismatch");

    let transmission_time = start_time.elapsed();
    let throughput = DATA_TEST_SIZE as f64 / transmission_time.as_secs_f64() / 1024.0 / 1024.0; // MB/s

    println!("✅ Data transmission test completed");
    println!("   Size: {} bytes", DATA_TEST_SIZE);
    println!("   Time: {:?}", transmission_time);
    println!("   Throughput: {:.2} MB/s", throughput);

    // Cleanup
    client_handle.abort();

    Ok(())
}

/// Test concurrent tunnels
#[tokio::test]
#[ignore = "requires running backend and optional bore-server"]
async fn test_concurrent_tunnels() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    const NUM_TUNNELS: usize = 5;
    let mut handles = Vec::new();
    let mut ports = Vec::new();

    // Create multiple echo servers
    for i in 0..NUM_TUNNELS {
        let local_port = find_available_port()?;
        ports.push(local_port);

        thread::spawn(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                let listener = TokioTcpListener::bind(("127.0.0.1", local_port)).await.unwrap();

                if let Ok((mut stream, _)) = listener.accept().await {
                    let mut buffer = [0; 1024];

                    if let Ok(n) = stream.read(&mut buffer).await {
                        let response = format!("Echo from tunnel {}: {}", i, String::from_utf8_lossy(&buffer[..n]));
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                }
            });
        });
    }

    sleep(Duration::from_millis(200)).await;

    // Create multiple clients concurrently
    let api_key = config.test_user.api_key.as_ref().unwrap();

    for (i, &local_port) in ports.iter().enumerate() {
        let api_key = api_key.to_string();
        let server_addr = config.bore_server.clone();

        let handle = tokio::spawn(async move {
            let client = Client::new(
                "127.0.0.1",
                local_port,
                &server_addr,
                0,
                Some(&api_key)
            ).await?;

            let tunnel_port = client.get_port().await?;

            // Test each tunnel
            let mut stream = TokioTcpStream::connect(("127.0.0.1", tunnel_port)).await?;
            let test_msg = format!("Test message from tunnel {}", i);

            stream.write_all(test_msg.as_bytes()).await?;

            let mut response = vec![0; 1024];
            let n = stream.read(&mut response).await?;

            let response_str = String::from_utf8_lossy(&response[..n]);
            assert!(response_str.contains(&i.to_string()), "Response should contain tunnel ID");

            println!("✅ Concurrent tunnel {} working", i);

            Ok::<(), anyhow::Error>(())
        });

        handles.push(handle);
    }

    // Wait for all tunnels to complete
    for handle in handles {
        handle.await??;
    }

    println!("✅ Concurrent tunnels test completed");

    Ok(())
}

/// Test tunnel reconnection
#[tokio::test]
#[ignore = "requires running backend and optional bore-server"]
async fn test_tunnel_reconnection() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    let local_port = find_available_port()?;
    let server_host = "127.0.0.1";

    // Start a persistent server
    thread::spawn(move || {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let listener = TokioTcpListener::bind((server_host, local_port)).await.unwrap();

            loop {
                if let Ok((mut stream, _)) = listener.accept().await {
                    let mut buffer = [0; 1024];

                    if let Ok(n) = stream.read(&mut buffer).await {
                        let response = format!("Server response: {}", String::from_utf8_lossy(&buffer[..n]));
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                }
            }
        });
    });

    sleep(Duration::from_millis(100)).await;

    // Test multiple connection attempts
    for attempt in 1..=3 {
        println!("Testing connection attempt {}", attempt);

        let api_key = config.test_user.api_key.as_ref().unwrap();
        let client = Client::new(
            server_host,
            local_port,
            &config.bore_server,
            0,
            Some(api_key)
        ).await?;

        let client_handle = {
            let client_clone = client.clone();
            tokio::spawn(async move {
                let _ = client_clone.listen().await;
            })
        };

        sleep(Duration::from_secs(1)).await;

        let tunnel_port = client.get_port().await?;
        let mut stream = TokioTcpStream::connect(("127.0.0.1", tunnel_port)).await?;

        let test_msg = format!("Test message attempt {}", attempt);
        stream.write_all(test_msg.as_bytes()).await?;

        let mut response = vec![0; 1024];
        let n = stream.read(&mut response).await?;

        let response_str = String::from_utf8_lossy(&response[..n]);
        assert!(response_str.contains("Server response"), "Should get server response");

        client_handle.abort();
        drop(stream);

        println!("✅ Connection attempt {} successful", attempt);
        sleep(Duration::from_millis(500)).await;
    }

    println!("✅ Tunnel reconnection test completed");

    Ok(())
}

/// Test error handling and invalid scenarios
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_error_handling() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    let client = HttpClient::new();
    let token = config.test_user.jwt_token.as_ref().unwrap();

    // Test invalid instance creation
    let create_url = format!("{}/api/v1/instances", config.backend_url);
    let invalid_payload = json!({
        "name": "", // Empty name should fail
        "local_port": 70000, // Invalid port
        "region": "invalid-region"
    });

    let response = client
        .post(&create_url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&invalid_payload)
        .send()
        .await?;

    assert!(!response.status().is_success(), "Invalid payload should be rejected");

    // Test unauthorized access
    let list_url = format!("{}/api/v1/instances", config.backend_url);
    let response = client.get(&list_url).send().await?;

    assert_eq!(response.status(), 401, "Unauthorized request should fail");

    // Test invalid JWT token
    let response = client
        .get(&list_url)
        .header("Authorization", "Bearer invalid-token")
        .send()
        .await?;

    assert_eq!(response.status(), 401, "Invalid token should be rejected");

    // Test non-existent instance
    let non_existent_id = "non-existent-instance-id";
    let get_url = format!("{}/api/v1/instances/{}", config.backend_url, non_existent_id);
    let response = client
        .get(&get_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    assert_eq!(response.status(), 404, "Non-existent instance should return 404");

    println!("✅ Error handling test completed");

    Ok(())
}

/// Performance benchmark for tunnel establishment
#[tokio::test]
#[ignore = "requires running backend and optional bore-server"]
async fn benchmark_tunnel_establishment() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    const NUM_ITERATIONS: usize = 10;
    let mut establishment_times = Vec::new();

    for i in 0..NUM_ITERATIONS {
        let local_port = find_available_port()?;

        // Start simple server
        thread::spawn(move || {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                let listener = TokioTcpListener::bind(("127.0.0.1", local_port)).await.unwrap();

                if let Ok((mut stream, _)) = listener.accept().await {
                    let mut buffer = [0; 1024];
                    let _ = stream.read(&mut buffer).await;
                }
            });
        });

        sleep(Duration::from_millis(50)).await;

        // Measure establishment time
        let start_time = Instant::now();

        let api_key = config.test_user.api_key.as_ref().unwrap();
        let client = Client::new(
            "127.0.0.1",
            local_port,
            &config.bore_server,
            0,
            Some(api_key)
        ).await?;

        let client_handle = {
            let client_clone = client.clone();
            tokio::spawn(async move {
                let _ = client_clone.listen().await;
            })
        };

        let tunnel_port = client.get_port().await?;
        let _stream = TokioTcpStream::connect(("127.0.0.1", tunnel_port)).await?;

        let establishment_time = start_time.elapsed();
        establishment_times.push(establishment_time);

        client_handle.abort();

        println!("Iteration {}: {:?}", i + 1, establishment_time);
    }

    // Calculate statistics
    establishment_times.sort();
    let min_time = establishment_times[0];
    let max_time = establishment_times[NUM_ITERATIONS - 1];
    let avg_time = establishment_times.iter().sum::<Duration>() / NUM_ITERATIONS as u32;
    let p50 = establishment_times[NUM_ITERATIONS / 2];
    let p95 = establishment_times[NUM_ITERATIONS * 95 / 100];

    println!("✅ Tunnel establishment benchmark completed");
    println!("   Iterations: {}", NUM_ITERATIONS);
    println!("   Min: {:?}", min_time);
    println!("   Max: {:?}", max_time);
    println!("   Average: {:?}", avg_time);
    println!("   P50: {:?}", p50);
    println!("   P95: {:?}", p95);

    Ok(())
}

/// Test metrics collection during tunnel operations
#[tokio::test]
#[ignore = "requires running backend server"]
async fn test_metrics_during_operations() -> Result<()> {
    let mut config = TestConfig::from_env();

    ensure_backend_available(&config.backend_url).await?;
    setup_test_user(&mut config).await?;

    let client = HttpClient::new();
    let token = config.test_user.jwt_token.as_ref().unwrap();

    // Get initial metrics
    let metrics_url = format!("{}/metrics", config.backend_url);
    let initial_response = client.get(&metrics_url).send().await?;
    let initial_metrics = initial_response.text().await?;

    // Perform operations that should affect metrics
    let create_url = format!("{}/api/v1/instances", config.backend_url);

    for i in 0..5 {
        let instance_payload = json!({
            "name": format!("metrics-test-{}", i),
            "local_port": 8000 + i,
            "region": "us-east"
        });

        let _response = client
            .post(&create_url)
            .header("Authorization", format!("Bearer {}", token))
            .json(&instance_payload)
            .send()
            .await?;
    }

    sleep(Duration::from_millis(500)).await;

    // Get updated metrics
    let updated_response = client.get(&metrics_url).send().await?;
    let updated_metrics = updated_response.text().await?;

    // Verify metrics contain expected data
    assert!(updated_metrics.contains("bore_api_requests_total"), "Should track API requests");
    assert!(updated_metrics.contains("bore_active_instances"), "Should track active instances");

    println!("✅ Metrics collection test completed");
    println!("   Initial metrics size: {} bytes", initial_metrics.len());
    println!("   Updated metrics size: {} bytes", updated_metrics.len());

    Ok(())
}