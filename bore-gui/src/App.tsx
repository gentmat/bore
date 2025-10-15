import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignUpPage";
import Dashboard from "./components/Dashboard";

interface Credentials {
  user_id: string;
  token: string;
  email: string;
}

interface DependencyStatus {
  bore_installed: boolean;
  bore_installed_now: boolean;
  bore_error?: string | null;
  code_server_installed: boolean;
  code_server_installed_now: boolean;
  code_server_error?: string | null;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [initMessage, setInitMessage] = useState("Preparing environment...");
  const [showSignUp, setShowSignUp] = useState(false);
  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  const initializeApp = useCallback(async () => {
    setLoading(true);
    setDependencyError(null);
    setDependencyStatus(null);
    setInitMessage("Checking bore-client and code-server...");

    try {
      const status = await invoke<DependencyStatus>("ensure_dependencies");
      setDependencyStatus(status);

      const issues: string[] = [];
      if (!status.bore_installed) {
        issues.push(status.bore_error ?? "bore-client is not installed.");
      }
      if (!status.code_server_installed) {
        issues.push(status.code_server_error ?? "code-server is not installed.");
      }

      if (issues.length > 0) {
        setDependencyError(issues.join(" "));
        return;
      }

      setInitMessage("Checking authentication...");
      try {
        const creds = await invoke<Credentials | null>("check_auth");
        if (creds) {
          setCredentials(creds);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      }
    } catch (error: any) {
      setDependencyError(error?.toString() ?? "Failed to ensure dependencies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const handleLogin = (creds: Credentials) => {
    setCredentials(creds);
    setIsAuthenticated(true);
  };

  const handleSignUp = (creds: Credentials) => {
    setCredentials(creds);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await invoke("logout");
      setCredentials(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">{initMessage}</p>
        </div>
      </div>
    );
  }

  if (dependencyError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 p-6">
        <div className="bg-white shadow-2xl rounded-2xl max-w-2xl w-full p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Dependency setup failed</h2>
            <p className="mt-2 text-sm text-gray-600">
              {dependencyError}
            </p>
          </div>

          {dependencyStatus && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700">
              <div>
                <span className="font-medium text-gray-900">bore-client:</span>{" "}
                {dependencyStatus.bore_installed
                  ? dependencyStatus.bore_installed_now
                    ? "✓ Installed successfully during this startup."
                    : "✓ Already installed."
                  : "✗ Not installed."}
                {dependencyStatus.bore_error && (
                  <span className="text-red-600 block mt-1 text-xs">Error: {dependencyStatus.bore_error}</span>
                )}
              </div>
              <div>
                <span className="font-medium text-gray-900">code-server:</span>{" "}
                {dependencyStatus.code_server_installed
                  ? dependencyStatus.code_server_installed_now
                    ? "✓ Installed successfully during this startup."
                    : "✓ Already installed."
                  : "✗ Not installed."}
                {dependencyStatus.code_server_error && (
                  <span className="text-red-600 block mt-1 text-xs">Error: {dependencyStatus.code_server_error}</span>
                )}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
            <h3 className="font-semibold text-blue-900 mb-2">Manual Installation Steps:</h3>
            <div className="space-y-2 text-blue-800">
              {!dependencyStatus?.bore_installed && (
                <div>
                  <p className="font-medium">For bore-client:</p>
                  <code className="block bg-white p-2 rounded mt-1 text-xs overflow-x-auto">
                    # Build bore-client from source<br/>
                    cd bore-client && cargo build --release
                  </code>
                </div>
              )}
              {!dependencyStatus?.code_server_installed && (
                <div className="mt-3">
                  <p className="font-medium">For code-server:</p>
                  <code className="block bg-white p-2 rounded mt-1 text-xs overflow-x-auto">
                    curl -fsSL https://code-server.dev/install.sh | sh
                  </code>
                </div>
              )}
              <p className="mt-3 text-xs text-blue-700">
                ⚠️ Make sure <code className="bg-white px-1 rounded">~/.local/bin</code> is in your PATH. 
                Add this to your <code className="bg-white px-1 rounded">~/.bashrc</code> or <code className="bg-white px-1 rounded">~/.zshrc</code>:
              </p>
              <code className="block bg-white p-2 rounded text-xs">
                export PATH="$HOME/.local/bin:$PATH"
              </code>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={initializeApp}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {isAuthenticated ? (
        <Dashboard credentials={credentials!} onLogout={handleLogout} />
      ) : showSignUp ? (
        <SignUpPage 
          onSignUp={handleSignUp} 
          onSwitchToLogin={() => setShowSignUp(false)}
        />
      ) : (
        <LoginPage 
          onLogin={handleLogin} 
          onSwitchToSignUp={() => setShowSignUp(true)}
        />
      )}
    </div>
  );
}

export default App;
