/// <reference types="dom" />

declare global {
  interface Window {
    API_BASE?: string;
    claimPlan?: () => Promise<void>;
    closeModal?: () => void;
    goToDashboard?: () => void;
    viewTunnel?: (instanceId: string, instanceName: string, localPort: number) => Promise<void>;
    reloadTunnel?: () => void;
    openInNewWindow?: () => void;
  }

  var API_BASE: string;
  var token: string | null;
}

export {};
```

Now let me fix the circuit breaker test timing issue:
