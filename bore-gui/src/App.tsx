import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignUpPage";
import Dashboard from "./components/Dashboard";

interface Credentials {
  user_id: string;
  token: string;
  email: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const creds = await invoke<Credentials | null>("check_auth");
      if (creds) {
        setCredentials(creds);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

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
          <p className="mt-4 text-gray-600">Loading...</p>
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
