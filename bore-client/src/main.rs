use anyhow::Result;
use clap::{Parser, Subcommand};

mod client;

use client::Client;

#[derive(Parser, Debug)]
#[clap(author, version, about = "bore client - local proxy for TCP tunnels")]
struct Args {
    #[clap(subcommand)]
    command: Option<Command>,

    /// The local port to expose.
    #[clap(env = "BORE_LOCAL_PORT")]
    local_port: Option<u16>,

    /// The local host to expose.
    #[clap(short = 'l', long, value_name = "HOST", default_value = "localhost")]
    local_host: String,

    /// Address of the remote server to expose local ports to.
    #[clap(short, long, env = "BORE_SERVER")]
    to: Option<String>,

    /// Optional port on the remote server to select.
    #[clap(short, long, default_value_t = 0)]
    port: u16,

    /// Optional secret for authentication.
    #[clap(short, long, env = "BORE_SECRET", hide_env_values = true)]
    secret: Option<String>,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Starts a local proxy to the remote server (default command).
    Local {
        /// The local port to expose.
        #[clap(env = "BORE_LOCAL_PORT")]
        local_port: u16,

        /// The local host to expose.
        #[clap(short = 'l', long, value_name = "HOST", default_value = "localhost")]
        local_host: String,

        /// Address of the remote server to expose local ports to.
        #[clap(short, long, env = "BORE_SERVER")]
        to: String,

        /// Optional port on the remote server to select.
        #[clap(short, long, default_value_t = 0)]
        port: u16,

        /// Optional secret for authentication.
        #[clap(short, long, env = "BORE_SECRET", hide_env_values = true)]
        secret: Option<String>,
    },
}

#[tokio::main]
async fn run(args: Args) -> Result<()> {
    // Support both subcommand and direct arguments for backwards compatibility
    let (local_host, local_port, to, port, secret) = match args.command {
        Some(Command::Local {
            local_host,
            local_port,
            to,
            port,
            secret,
        }) => (local_host, local_port, to, port, secret),
        None => {
            // Direct arguments mode (simpler usage)
            let local_port = args.local_port.ok_or_else(|| {
                anyhow::anyhow!("local_port is required. Usage: bore <LOCAL_PORT> --to <SERVER>")
            })?;
            let to = args.to.ok_or_else(|| {
                anyhow::anyhow!("--to <SERVER> is required")
            })?;
            (args.local_host, local_port, to, args.port, args.secret)
        }
    };

    let client = Client::new(&local_host, local_port, &to, port, secret.as_deref()).await?;
    client.listen().await?;

    Ok(())
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    run(Args::parse())
}
