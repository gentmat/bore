use anyhow::Result;
use bore_client::client::Client;
use tokio::sync::oneshot;
use tracing::info;

pub struct TunnelConfig {
    pub instance_id: String,
    pub local_host: String,
    pub local_port: u16,
    pub server_host: String,
    pub remote_port: u16,
    pub secret: Option<String>,
    pub ready_tx: Option<oneshot::Sender<u16>>,
    pub shutdown_rx: Option<oneshot::Receiver<()>>,
}

pub async fn start_tunnel_connection(config: TunnelConfig) -> Result<()> {
    info!(
        "Starting tunnel for instance {} to {}",
        config.instance_id, config.server_host
    );

    let client = Client::new(
        &config.local_host,
        config.local_port,
        &config.server_host,
        config.remote_port,
        config.secret.as_deref(),
    )
    .await?;

    if let Some(tx) = config.ready_tx {
        let _ = tx.send(client.remote_port());
    }

    // Run client with graceful shutdown support
    if let Some(mut shutdown_rx) = config.shutdown_rx {
        tokio::select! {
            result = client.listen() => {
                result?;
            }
            _ = &mut shutdown_rx => {
                info!("Tunnel shutdown signal received for instance {}", config.instance_id);
                // Graceful shutdown - just exit the select and drop the client
            }
        }
    } else {
        client.listen().await?;
    }
    
    info!("Tunnel connection closed for instance {}", config.instance_id);
    Ok(())
}
