# Dynamic Button Behavior

## Visual Button States

The Start/Stop button dynamically changes based on the tunnel's actual connection state:

```
┌─────────────────────────────────────────────────────────────┐
│                    CREATE INSTANCE                          │
│  User creates instance → Tunnel auto-starts immediately     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Button State: [▶ Starting...]                              │
│  Status: STARTING (yellow badge with pulsing dot 🟡)        │
│  Action: Disabled - connecting in background                │
└─────────────────────────────────────────────────────────────┘
                              ↓
                   (Tunnel connects)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Button State: [■ Stop]                                     │
│  Status: ACTIVE (green badge 🟢)                            │
│  Action: Click to stop tunnel                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
                   (User clicks Stop)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Button State: [▶ Start]                                    │
│  Status: INACTIVE (gray badge ⚪)                           │
│  Action: Click to restart tunnel                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                   (User clicks Start)
                              ↓
            (Cycles back to Starting → Active)
```

## Error State

If tunnel encounters an error during connection:

```
┌─────────────────────────────────────────────────────────────┐
│  Button State: [▶ Start]                                    │
│  Status: ERROR (red badge 🔴)                               │
│  Error Message: "Connection failed: ..."                    │
│  Action: Click to retry connection                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

✅ **No Manual Start Needed** - Tunnels connect automatically when created  
✅ **Button Follows State** - UI always shows correct action (Start vs Stop)  
✅ **Real-Time Updates** - Changes happen instantly via events  
✅ **Visual Feedback** - Pulsing dot shows active connection attempts  
✅ **Error Recovery** - Failed tunnels can be restarted with one click  

## Implementation

The button logic in `TunnelCard.tsx`:

```typescript
{isActive ? (
  <button onClick={onStop}>
    <Square /> Stop
  </button>
) : (
  <button onClick={onStart} disabled={isStarting}>
    <Play /> {isStarting ? "Starting..." : "Start"}
  </button>
)}
```

Status updates trigger via Tauri events:
- Backend emits `tunnel-status-changed` event
- Frontend listens and refreshes instance list
- Button automatically updates based on new status
