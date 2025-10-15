use anyhow::{anyhow, Result};
use bore_shared::protocol::ClientMessage;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::{error, info};

pub struct TunnelConfig {
    pub instance_id: String,
    pub local_port: u16,
    pub server_address: String,
    pub secret: String,
}

pub async fn start_tunnel_connection(config: TunnelConfig) -> Result<()> {
    info!(
        "Starting tunnel for instance {} to {}",
        config.instance_id, config.server_address
    );

    // Connect to the bore server
    let mut stream = TcpStream::connect(&config.server_address).await?;

    // Send authentication
    let auth = ClientMessage::Authenticate(config.secret.clone());
    let auth_bytes = serde_json::to_vec(&auth)?;
    stream.write_all(&auth_bytes).await?;
    stream.write_all(b"\n").await?;

    info!("Authentication sent for instance {}", config.instance_id);

    // Read response
    let mut response = Vec::new();
    let mut buf = [0u8; 1024];

    match tokio::time::timeout(Duration::from_secs(10), stream.read(&mut buf)).await {
        Ok(Ok(n)) if n > 0 => {
            response.extend_from_slice(&buf[..n]);
            info!(
                "Received response: {:?}",
                String::from_utf8_lossy(&response)
            );
        }
        Ok(Ok(_)) => {
            return Err(anyhow!("Connection closed by server"));
        }
        Ok(Err(e)) => {
            return Err(anyhow!("Error reading from server: {}", e));
        }
        Err(_) => {
            return Err(anyhow!("Timeout waiting for server response"));
        }
    }

    // Start forwarding loop
    loop {
        // Accept connection from bore server
        let mut client_stream = match TcpStream::connect(&config.server_address).await {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to connect to server: {}", e);
                tokio::time::sleep(Duration::from_secs(5)).await;
                continue;
            }
        };

        // Connect to local service
        let local_addr = format!("127.0.0.1:{}", config.local_port);
        let mut local_stream = match TcpStream::connect(&local_addr).await {
            Ok(s) => s,
            Err(e) => {
                error!(
                    "Failed to connect to local service at {}: {}",
                    local_addr, e
                );
                tokio::time::sleep(Duration::from_secs(1)).await;
                continue;
            }
        };

        // Bidirectional forwarding
        tokio::spawn(async move {
            let (mut client_read, mut client_write) = client_stream.split();
            let (mut local_read, mut local_write) = local_stream.split();

            let client_to_local = tokio::io::copy(&mut client_read, &mut local_write);
            let local_to_client = tokio::io::copy(&mut local_read, &mut client_write);

            tokio::select! {
                _ = client_to_local => {},
                _ = local_to_client => {},
            }
        });

        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
