use std::net::IpAddr;

use anyhow::Result;
use clap::{error::ErrorKind, CommandFactory, Parser};

mod backend;
mod server;

use server::Server;

#[derive(Parser, Debug)]
#[clap(author, version, about = "bore server - TCP tunnel server")]
struct Args {
    /// Minimum accepted TCP port number.
    #[clap(long, default_value_t = 1024, env = "BORE_MIN_PORT")]
    min_port: u16,

    /// Maximum accepted TCP port number.
    #[clap(long, default_value_t = 65535, env = "BORE_MAX_PORT")]
    max_port: u16,

    /// Optional secret for authentication (deprecated, use backend API instead).
    #[clap(short, long, env = "BORE_SECRET", hide_env_values = true)]
    secret: Option<String>,

    /// Backend API URL for user authentication and usage tracking.
    #[clap(long, env = "BORE_BACKEND_URL")]
    backend_url: Option<String>,

    /// Internal API key for backend status updates.
    #[clap(long, env = "BORE_BACKEND_API_KEY", hide_env_values = true)]
    backend_api_key: Option<String>,

    /// Server ID for multi-server deployments (used in usage tracking).
    #[clap(long, env = "BORE_SERVER_ID", default_value = "default")]
    server_id: String,

    /// Hostname or IP to advertise to the backend for client connections.
    #[clap(long, env = "BORE_ADVERTISE_HOST")]
    advertise_host: Option<String>,

    /// Optional location label for this server.
    #[clap(long, env = "BORE_SERVER_LOCATION")]
    location: Option<String>,

    /// IP address to bind to, clients must reach this.
    #[clap(long, default_value = "0.0.0.0")]
    bind_addr: IpAddr,

    /// IP address where tunnels will listen on, defaults to --bind-addr.
    #[clap(long)]
    bind_tunnels: Option<IpAddr>,
}

#[tokio::main]
async fn run(args: Args) -> Result<()> {
    let port_range = args.min_port..=args.max_port;
    if port_range.is_empty() {
        Args::command()
            .error(ErrorKind::InvalidValue, "port range is empty")
            .exit();
    }

    let advertise_host = args
        .advertise_host
        .unwrap_or_else(|| args.bind_tunnels.unwrap_or(args.bind_addr).to_string());
    let location = args.location.unwrap_or_else(|| "local".to_string());

    let mut server = Server::new(
        port_range,
        args.secret.as_deref(),
        args.backend_url,
        args.backend_api_key,
        args.server_id,
        advertise_host,
        location,
    );
    server.set_bind_addr(args.bind_addr);
    server.set_bind_tunnels(args.bind_tunnels.unwrap_or(args.bind_addr));
    server.listen().await?;

    Ok(())
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    run(Args::parse())
}
