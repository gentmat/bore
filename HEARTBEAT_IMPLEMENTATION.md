# Heartbeat Implementation Summary

## Overview
Both the bore-gui (Tauri desktop app) and bore-client (CLI) now send heartbeat signals to the backend server every 10 seconds to report online/offline status.

## Backend Changes (server.js)

### Heartbeat Tracking System
- **Heartbeat Map**: Tracks last heartbeat timestamp for each instance
- **Timeout**: 15 seconds - if no heartbeat received, instance marked as offline
- **Periodic Check**: Every 5 seconds, checks for timed-out instances

### New API Endpoint
```
POST /api/instances/:id/heartbeat
Authorization: Bearer <token>
```
- Updates instance status to "online"
- Records current timestamp

### Status Flow
1. **Instance Created**: Status = "inactive"
2. **Client Connects**: Status = "online" (via heartbeat)
3. **Client Running**: Status = "online" (heartbeat every 10s)
4. **Client Disconnects**: Status = "offline" (no more heartbeats)
5. **Heartbeat Timeout**: Status = "offline" (after 15s without heartbeat)

## bore-gui Changes (Tauri Desktop App)

### Files Modified
- `bore-gui/src-tauri/src/commands.rs`
  - Added heartbeat task in `start_tunnel()` function
  - Added heartbeat task in `start_code_server_instance()` function
  - Spawns background task that sends heartbeat every 10 seconds

### Heartbeat Implementation
```rust
tokio::spawn(async move {
    let client = reqwest::Client::new();
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
        
        let _ = client
            .post(format!("http://127.0.0.1:3000/api/instances/{}/heartbeat", instance_id))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await;
    }
});
```

## bore-client Changes (CLI)

### Files Modified
- `bore-client/src/api_client.rs`
  - Added `send_heartbeat()` method to ApiClient

- `bore-client/src/main.rs`
  - Modified `handle_start()` to spawn heartbeat task
  - Updated `handle_list()` to show online/offline status

### Heartbeat Implementation
```rust
tokio::spawn(async move {
    use tokio::time::{interval, Duration};
    let mut heartbeat_interval = interval(Duration::from_secs(10));
    
    loop {
        heartbeat_interval.tick().await;
        if let Err(e) = api_client_clone.send_heartbeat(&instance_id).await {
            tracing::warn!("Failed to send heartbeat: {}", e);
        }
    }
});
```

### CLI Status Display
```bash
$ bore list

Available instances:

  🟢 my-code-server (inst_abc123) - Online
     Local port: 8080
     Region: local

  🔴 old-server (inst_xyz789) - Offline
     Local port: 3000
     Region: local
```

## Web Dashboard Changes

### Status Display
- **Online (🟢)**: Client connected and sending heartbeats
- **Offline (🔴)**: No heartbeat received for 15+ seconds
- **View Button**: Only enabled when status is "online"

### CSS Styles
```css
.status-online {
    background: #d1fae5;
    color: #065f46;
}

.status-offline {
    background: #fee2e2;
    color: #991b1b;
}
```

## Feature Parity

Both bore-gui and bore-client now have identical functionality:

| Feature | bore-gui | bore-client |
|---------|----------|-------------|
| Login/Logout | ✅ | ✅ |
| List Instances | ✅ | ✅ |
| Create Instance | ✅ | ❌ (via GUI only) |
| Start Tunnel | ✅ | ✅ |
| Stop Tunnel | ✅ | ✅ |
| Rename Instance | ✅ | ❌ (via GUI only) |
| Delete Instance | ✅ | ❌ (via GUI only) |
| **Heartbeat/Status** | ✅ | ✅ |
| Project Folder | ✅ | N/A |

## Testing

### Test Heartbeat System
1. Start backend server: `node backend/server.js`
2. Login via CLI: `bore login`
3. Start a tunnel: `bore start my-instance`
4. Open web dashboard: `http://localhost:3000/dashboard`
5. Verify instance shows as "Online" with green status
6. Stop the CLI (Ctrl+C)
7. Wait 15 seconds
8. Refresh dashboard - instance should show as "Offline" with red status

### Test with bore-gui
1. Start bore-gui application
2. Login with credentials
3. Create a new instance with project folder
4. Instance should appear in web dashboard as "Online"
5. Close bore-gui
6. Wait 15 seconds
7. Instance should show as "Offline" in dashboard

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  bore-gui   │         │ bore-client │         │   Backend   │
│   (Tauri)   │         │    (CLI)    │         │   Server    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  Start Tunnel         │  Start Tunnel         │
       ├──────────────────────►│──────────────────────►│
       │                       │                       │
       │  Heartbeat (10s)      │  Heartbeat (10s)      │
       ├──────────────────────►├──────────────────────►│
       │                       │                       │ Check timeout (5s)
       │                       │                       ├──────────┐
       │                       │                       │          │
       │                       │                       │◄─────────┘
       │                       │                       │
       │  Stop/Disconnect      │  Stop/Disconnect      │
       ├──────────────────────►├──────────────────────►│
       │                       │                       │
       │                       │                       │ Mark offline
       │                       │                       ├──────────┐
       │                       │                       │          │
       │                       │                       │◄─────────┘
```

## Benefits

1. **Real-time Status**: Server dashboard shows accurate online/offline status
2. **Automatic Detection**: No manual status updates needed
3. **Timeout Handling**: Crashed clients automatically marked offline
4. **Consistent Experience**: Same behavior in GUI and CLI
5. **Simple Protocol**: HTTP POST every 10 seconds
6. **Fault Tolerant**: Failed heartbeats logged but don't crash client
