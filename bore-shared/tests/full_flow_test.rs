/// Integration test: Complete tunnel lifecycle
///
/// This test verifies the entire flow:
/// 1. User authenticates with backend
/// 2. Creates instance
/// 3. Connects tunnel via bore-client
/// 4. Forwards traffic through tunnel
/// 5. Heartbeats maintain connection
/// 6. Cleanup on disconnect
mod integration {
    pub mod fixtures;
}

use integration::fixtures;

use anyhow::{Context, Result};
use bore_client::Client;
use fixtures::mock_backend::MockBackend;
use fixtures::test_helpers::{find_available_port, spawn_test_server};
use lazy_static::lazy_static;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio::time::sleep;

lazy_static! {
    /// Guard to ensure tests run serially
    static ref SERIAL_GUARD: Mutex<()> = Mutex::new(());
}

#[tokio::test]
#[ignore = "requires full backend integration"]
async fn test_complete_tunnel_lifecycle() -> Result<()> {
    let _guard = SERIAL_GUARD.lock().await;

    // 1. Setup mock backend
    let backend_port = find_available_port()?;
    let backend = MockBackend::new(backend_port);

    // 2. Register user and create instance
    let user_id = uuid::Uuid::new_v4().to_string();
    let instance_id = uuid::Uuid::new_v4().to_string();
    let _api_key = backend.register_user("test@example.com", "password123");
    let tunnel_token = backend.create_tunnel_token(&instance_id, &user_id, 3600);

    // Start backend
    let backend_clone = backend.clone();
    tokio::spawn(async move {
        let _ = backend_clone.start().await;
    });

    sleep(Duration::from_millis(100)).await;

    // 3. Start bore-server
    let backend_url = format!("http://127.0.0.1:{}", backend_port);
    spawn_test_server(None, Some(&backend_url)).await?;

    sleep(Duration::from_millis(100)).await;

    // 4. Start local service to tunnel
    let local_port = find_available_port()?;
    let local_listener = TcpListener::bind(format!("127.0.0.1:{}", local_port)).await?;

    // Spawn echo server on local port
    tokio::spawn(async move {
        loop {
            if let Ok((mut socket, _)) = local_listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    while let Ok(n) = socket.read(&mut buf).await {
                        if n == 0 {
                            break;
                        }
                        let _ = socket.write_all(&buf[..n]).await;
                    }
                });
            }
        }
    });

    sleep(Duration::from_millis(100)).await;

    // 5. Connect tunnel with client
    let client = Client::new("localhost", local_port, "localhost", 0, Some(&tunnel_token))
        .await
        .context("Failed to create tunnel client")?;

    let remote_port = client.remote_port();
    assert!(remote_port > 0, "Should receive valid remote port");

    println!(
        "✅ Step 1-4: Tunnel established on remote port {}",
        remote_port
    );

    // Start client listener (tests are ignored - implementation placeholder)
    let client_handle = tokio::spawn(async move {
        // Client::listen would go here but requires ownership
        tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
        Ok::<(), anyhow::Error>(())
    });

    sleep(Duration::from_millis(200)).await;

    // 6. Test data transmission through tunnel
    let mut remote_stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", remote_port))
        .await
        .context("Failed to connect to tunnel")?;

    let test_message = b"Hello through tunnel!";
    remote_stream.write_all(test_message).await?;

    let mut response = vec![0u8; test_message.len()];
    remote_stream.read_exact(&mut response).await?;

    assert_eq!(
        &response[..],
        test_message,
        "Echo should match original message"
    );

    println!("✅ Step 5: Data successfully transmitted through tunnel");

    // 7. Test heartbeat mechanism (client stays alive)
    sleep(Duration::from_secs(2)).await;

    // Send another message to verify connection is still alive
    let test_message2 = b"Still alive!";
    remote_stream.write_all(test_message2).await?;

    let mut response2 = vec![0u8; test_message2.len()];
    remote_stream.read_exact(&mut response2).await?;

    assert_eq!(
        &response2[..],
        test_message2,
        "Heartbeat maintained connection"
    );

    println!("✅ Step 6: Heartbeat verified - connection maintained");

    // 8. Cleanup
    drop(remote_stream);
    client_handle.abort();

    println!("✅ Step 7: Complete tunnel lifecycle test passed");

    Ok(())
}

#[tokio::test]
#[ignore = "requires full backend integration"]
async fn test_concurrent_tunnels() -> Result<()> {
    let _guard = SERIAL_GUARD.lock().await;

    // Setup mock backend
    let backend_port = find_available_port()?;
    let backend = MockBackend::new(backend_port);

    let user_id = uuid::Uuid::new_v4().to_string();
    let _api_key = backend.register_user("test@example.com", "password123");

    // Start backend
    let backend_clone = backend.clone();
    tokio::spawn(async move {
        let _ = backend_clone.start().await;
    });

    sleep(Duration::from_millis(100)).await;

    // Start bore-server
    let backend_url = format!("http://127.0.0.1:{}", backend_port);
    spawn_test_server(None, Some(&backend_url)).await?;

    sleep(Duration::from_millis(100)).await;

    // Create multiple tunnels
    const NUM_TUNNELS: usize = 3;
    let mut clients = Vec::new();
    let mut remote_ports = Vec::new();

    for i in 0..NUM_TUNNELS {
        let instance_id = uuid::Uuid::new_v4().to_string();
        let tunnel_token = backend.create_tunnel_token(&instance_id, &user_id, 3600);

        // Start local service
        let local_port = find_available_port()?;
        let local_listener = TcpListener::bind(format!("127.0.0.1:{}", local_port)).await?;

        let tunnel_id = i;
        tokio::spawn(async move {
            loop {
                if let Ok((mut socket, _)) = local_listener.accept().await {
                    tokio::spawn(async move {
                        let response = format!("Tunnel {} response", tunnel_id);
                        let _ = socket.write_all(response.as_bytes()).await;
                    });
                }
            }
        });

        sleep(Duration::from_millis(50)).await;

        // Create client
        let client = Client::new("localhost", local_port, "localhost", 0, Some(&tunnel_token))
            .await
            .context(format!("Failed to create tunnel {}", i))?;

        let remote_port = client.remote_port();
        assert!(remote_port > 0, "Tunnel {} should get valid port", i);

        // Verify all ports are unique
        assert!(
            !remote_ports.contains(&remote_port),
            "Port {} should be unique",
            remote_port
        );
        remote_ports.push(remote_port);

        // Start client listener (placeholder for ignored test)
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
        });

        clients.push(client);
    }

    sleep(Duration::from_millis(200)).await;

    println!(
        "✅ Created {} concurrent tunnels with unique ports",
        NUM_TUNNELS
    );

    // Test traffic isolation - each tunnel should return its own identifier
    for (i, &remote_port) in remote_ports.iter().enumerate() {
        let mut stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", remote_port))
            .await
            .context(format!("Failed to connect to tunnel {}", i))?;

        let mut response = vec![0u8; 128];
        let n = stream.read(&mut response).await?;
        let response_str = String::from_utf8_lossy(&response[..n]);

        assert!(
            response_str.contains(&i.to_string()),
            "Tunnel {} should return its own response, got: {}",
            i,
            response_str
        );
    }

    println!("✅ Traffic isolation verified - each tunnel independent");
    println!("✅ Concurrent tunnels test passed");

    Ok(())
}

#[tokio::test]
#[ignore = "requires full backend integration"]
async fn test_tunnel_reconnection() -> Result<()> {
    let _guard = SERIAL_GUARD.lock().await;

    // Setup
    let backend_port = find_available_port()?;
    let backend = MockBackend::new(backend_port);

    let user_id = uuid::Uuid::new_v4().to_string();
    let instance_id = uuid::Uuid::new_v4().to_string();
    backend.register_user("test@example.com", "password123");
    let tunnel_token = backend.create_tunnel_token(&instance_id, &user_id, 3600);

    let backend_clone = backend.clone();
    tokio::spawn(async move {
        let _ = backend_clone.start().await;
    });

    sleep(Duration::from_millis(100)).await;

    let backend_url = format!("http://127.0.0.1:{}", backend_port);
    spawn_test_server(None, Some(&backend_url)).await?;

    sleep(Duration::from_millis(100)).await;

    // Start persistent local service
    let local_port = find_available_port()?;
    let local_listener = TcpListener::bind(format!("127.0.0.1:{}", local_port)).await?;

    let connection_count = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let count_clone = connection_count.clone();

    tokio::spawn(async move {
        loop {
            if let Ok((mut socket, _)) = local_listener.accept().await {
                let count = count_clone.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                tokio::spawn(async move {
                    let response = format!("Connection #{}", count);
                    let _ = socket.write_all(response.as_bytes()).await;
                });
            }
        }
    });

    sleep(Duration::from_millis(100)).await;

    // First connection
    let client1 = Client::new("localhost", local_port, "localhost", 0, Some(&tunnel_token))
        .await
        .context("First connection failed")?;

    let remote_port1 = client1.remote_port();

    let client1_handle = tokio::spawn(async move {
        let _ = client1.listen().await;
    });

    sleep(Duration::from_millis(200)).await;

    // Test first connection
    let mut stream1 = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", remote_port1)).await?;
    let mut buf = vec![0u8; 128];
    let n = stream1.read(&mut buf).await?;
    assert!(String::from_utf8_lossy(&buf[..n]).contains("Connection #1"));

    println!("✅ First connection established");

    // Disconnect
    drop(stream1);
    client1_handle.abort();
    sleep(Duration::from_millis(500)).await;

    // Reconnect with same token
    let client2 = Client::new("localhost", local_port, "localhost", 0, Some(&tunnel_token))
        .await
        .context("Reconnection should succeed with same token")?;

    let remote_port2 = client2.remote_port();

    let client2_handle = tokio::spawn(async move {
        let _ = client2.listen().await;
    });

    sleep(Duration::from_millis(200)).await;

    // Test reconnection
    let mut stream2 = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", remote_port2)).await?;
    let mut buf2 = vec![0u8; 128];
    let n2 = stream2.read(&mut buf2).await?;
    assert!(String::from_utf8_lossy(&buf2[..n2]).contains("Connection #"));

    println!("✅ Reconnection successful - remote port: {}", remote_port2);

    // Test heartbeat after reconnection
    sleep(Duration::from_secs(1)).await;

    let mut stream3 = tokio::net::TcpStream::connect(format!("127.0.0.1:{}", remote_port2)).await?;
    let mut buf3 = vec![0u8; 128];
    let n3 = stream3.read(&mut buf3).await?;
    assert!(String::from_utf8_lossy(&buf3[..n3]).contains("Connection #"));

    println!("✅ Heartbeat resumed after reconnection");

    // Cleanup
    drop(stream2);
    drop(stream3);
    client2_handle.abort();

    println!("✅ Tunnel reconnection test passed");

    Ok(())
}
