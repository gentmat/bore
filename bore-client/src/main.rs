use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

mod client;
mod auth;
mod api_client;

use client::Client;
use auth::Credentials;
use api_client::ApiClient;

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
    /// Starts a local proxy to the remote server (legacy command).
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

    /// Login to your bore account
    Login {
        /// API endpoint URL (default: from environment or http://localhost:3000)
        #[clap(long, env = "BORE_API_ENDPOINT", default_value = "http://localhost:3000")]
        api_endpoint: String,
    },

    /// Logout from your bore account
    Logout,

    /// List all your tunnel instances
    List,

    /// Start a tunnel instance by name or ID
    Start {
        /// Instance name or ID
        instance: String,
    },

    /// Stop the current tunnel
    Stop,
}

#[tokio::main]
async fn run(args: Args) -> Result<()> {
    match args.command {
        Some(Command::Login { api_endpoint }) => {
            handle_login(api_endpoint).await
        }
        Some(Command::Logout) => {
            handle_logout()
        }
        Some(Command::List) => {
            handle_list().await
        }
        Some(Command::Start { instance }) => {
            handle_start(instance).await
        }
        Some(Command::Stop) => {
            handle_stop()
        }
        Some(Command::Local {
            local_host,
            local_port,
            to,
            port,
            secret,
        }) => {
            // Legacy mode: direct tunnel connection
            let client = Client::new(&local_host, local_port, &to, port, secret.as_deref()).await?;
            client.listen().await?;
            Ok(())
        }
        None => {
            // Direct arguments mode (backwards compatibility)
            let local_port = args.local_port.ok_or_else(|| {
                anyhow::anyhow!("local_port is required. Usage: bore <LOCAL_PORT> --to <SERVER>")
            })?;
            let to = args.to.ok_or_else(|| {
                anyhow::anyhow!("--to <SERVER> is required")
            })?;
            let client = Client::new(&args.local_host, local_port, &to, args.port, args.secret.as_deref()).await?;
            client.listen().await?;
            Ok(())
        }
    }
}

/// Handle login command
async fn handle_login(api_endpoint: String) -> Result<()> {
    use std::io::{self, Write};

    println!("Login to your bore account\n");
    
    // Prompt for email
    print!("Email: ");
    io::stdout().flush()?;
    let mut email = String::new();
    io::stdin().read_line(&mut email)?;
    let email = email.trim().to_string();

    // Prompt for password (using rpassword for hidden input)
    let password = rpassword::prompt_password("Password: ")
        .context("failed to read password")?;

    println!("\nAuthenticating...");
    
    // Login via API
    let mut api_client = ApiClient::new(api_endpoint.clone());
    let login_response = api_client.login(email, password).await?;

    // Save credentials
    let credentials = Credentials::new(
        api_endpoint,
        login_response.token,
        login_response.user_id,
    );
    credentials.save()?;

    println!("✓ Successfully logged in!");
    println!("  User ID: {}", credentials.user_id);
    
    Ok(())
}

/// Handle logout command
fn handle_logout() -> Result<()> {
    if !Credentials::exists() {
        println!("You are not logged in.");
        return Ok(());
    }

    Credentials::delete()?;
    println!("✓ Successfully logged out");
    Ok(())
}

/// Handle list command
async fn handle_list() -> Result<()> {
    let credentials = Credentials::load()?;
    let api_client = ApiClient::from_credentials(&credentials);
    
    println!("Fetching your tunnel instances...\n");
    let instances = api_client.list_instances().await?;

    if instances.is_empty() {
        println!("No instances found.");
        println!("Create one at your dashboard: {}/dashboard", credentials.api_endpoint);
        return Ok(());
    }

    println!("Available instances:\n");
    for instance in instances {
        let (status_icon, status_text) = match instance.status.as_str() {
            "online" => ("🟢", "Online"),
            "offline" => ("🔴", "Offline"),
            "active" => ("🟢", "Active"),
            "inactive" => ("⚪", "Inactive"),
            _ => ("🔵", "Unknown"),
        };
        println!("  {} {} ({}) - {}", status_icon, instance.name, instance.id, status_text);
        println!("     Local port: {}", instance.local_port);
        println!("     Region: {}", instance.server_region);
        if let Some(url) = instance.public_url {
            println!("     Public URL: {}", url);
        }
        println!();
    }

    Ok(())
}

/// Handle start command
async fn handle_start(instance_name_or_id: String) -> Result<()> {
    let credentials = Credentials::load()?;
    let api_client = ApiClient::from_credentials(&credentials);
    
    println!("Finding instance '{}'...", instance_name_or_id);
    let instance = api_client.find_instance(&instance_name_or_id).await?;
    
    println!("Connecting to '{}'...", instance.name);
    let connection_info = api_client.connect_instance(&instance.id).await?;

    println!("\n✓ Connected to \"{}\"", instance.name);
    println!("✓ Forwarding localhost:{}\n", connection_info.local_port);
    println!("  Instance ID: {}", connection_info.instance_id);
    println!("  Token TTL: {}s\n", connection_info.ttl);
    
    // Start heartbeat task to report online status
    let instance_id = instance.id.clone();
    let api_client_clone = ApiClient::from_credentials(&credentials);
    tokio::spawn(async move {
        use tokio::time::{interval, Duration};
        let mut heartbeat_interval = interval(Duration::from_secs(10));
        
        loop {
            heartbeat_interval.tick().await;
            if let Err(e) = api_client_clone.send_heartbeat(&instance_id).await {
                tracing::warn!("Failed to send heartbeat: {}", e);
            } else {
                tracing::debug!("Heartbeat sent for instance {}", instance_id);
            }
        }
    });
    
    // Start the tunnel using the temporary token
    let client = Client::new(
        "localhost",
        connection_info.local_port,
        &connection_info.server_host,
        connection_info.remote_port,
        Some(&connection_info.tunnel_token),
    ).await?;
    
    client.listen().await?;
    Ok(())
}

/// Handle stop command
fn handle_stop() -> Result<()> {
    // This is a placeholder - in reality you'd need to track running tunnels
    // and send them a shutdown signal, possibly using a local daemon or PID file
    println!("Stop command not yet implemented.");
    println!("For now, use Ctrl+C to stop the tunnel.");
    Ok(())
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    run(Args::parse())
}
