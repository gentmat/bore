# Delete Instance Functionality

## Overview

The delete functionality allows users to delete tunnel instances at any time, with automatic service cleanup.

## Features

### 🗑️ Delete Icon
- **Location**: Bottom-right of each tunnel card, next to Start/Stop button
- **Icon**: Trash icon (Trash2 from lucide-react)
- **Styling**: 
  - Default: Gray background
  - Hover: Red background with red icon
  - Visual feedback clearly indicates destructive action

### 🛡️ Smart Protection
- **Active instances**: Can be deleted (tunnel auto-stops first)
- **Starting instances**: Delete disabled while connecting
- **Inactive instances**: Delete immediately available
- **Error instances**: Delete available to clean up failed tunnels

### 🔄 Auto-Stop Behavior

When deleting an active instance:
1. Backend receives delete command
2. **Automatically stops tunnel** via `stop_tunnel()` 
3. Cleans up task handles and connections
4. Deletes instance from database
5. Emits status update events
6. UI refreshes and removes the card

### ⚠️ Confirmation Messages

**Active Instance:**
```
This tunnel is currently active. It will be stopped and deleted. Are you sure?
```

**Inactive Instance:**
```
Are you sure you want to delete this instance?
```

## Code Implementation

### Frontend (`TunnelCard.tsx`)
```tsx
<button
  onClick={onDelete}
  disabled={isStarting}
  className="... hover:bg-red-50 ... hover:text-red-600"
  title={isActive ? "Stop and delete instance" : "Delete instance"}
>
  <Trash2 className="w-4 h-4" />
</button>
```

### Backend (`commands.rs`)
```rust
pub async fn delete_instance(...) -> Result<bool, String> {
    tracing::info!("Deleting instance: {}", instance_id);
    
    // Stop tunnel if running (handles cleanup and events)
    stop_tunnel(app_handle.clone(), state.clone(), instance_id.clone()).await?;
    
    // Delete from API
    client.delete(format!("http://127.0.0.1:3000/api/instances/{}", instance_id))
        .header("Authorization", format!("Bearer {}", creds.token))
        .send().await?;
    
    // Emit status update
    app_handle.emit_all("tunnel-status-changed", &instance_id);
    
    Ok(true)
}
```

## Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User clicks Delete icon                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Show confirmation dialog                                   │
│  (Different message for active vs inactive)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
                      User confirms?
                     /              \
                   No               Yes
                    ↓                ↓
              Cancel         ┌────────────────────┐
                            │ Backend stops tunnel│
                            │ (if running)        │
                            └────────────────────┘
                                     ↓
                            ┌────────────────────┐
                            │ Delete from API     │
                            └────────────────────┘
                                     ↓
                            ┌────────────────────┐
                            │ Emit status event   │
                            └────────────────────┘
                                     ↓
                            ┌────────────────────┐
                            │ UI refreshes        │
                            │ Card removed        │
                            └────────────────────┘
```

## Safety Features

✅ **No orphaned processes** - Tunnel always stopped before deletion  
✅ **Port cleanup** - Ports released immediately for reuse  
✅ **Confirmation required** - Prevents accidental deletion  
✅ **Visual feedback** - Red hover state indicates danger  
✅ **Disabled during start** - Can't delete while connecting  
✅ **Real-time updates** - UI updates immediately via events  
✅ **Error handling** - Shows alert if deletion fails  

## Testing

1. ✅ Delete inactive instance → Immediate deletion
2. ✅ Delete active instance → Stops tunnel, then deletes
3. ✅ Delete during starting → Button disabled
4. ✅ Cancel confirmation → No action taken
5. ✅ Delete error instance → Cleans up failed tunnel

All builds verified:
- Frontend: ✓
- Backend: ✓
