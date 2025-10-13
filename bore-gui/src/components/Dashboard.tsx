import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import TunnelCard from "./TunnelCard";
import CreateInstanceModal from "./CreateInstanceModal";
import { Plus, RefreshCw, LogOut, User } from "lucide-react";

interface Credentials {
  user_id: string;
  token: string;
  email: string;
}

interface DashboardProps {
  credentials: Credentials;
  onLogout: () => void;
}

export interface TunnelInstance {
  id: string;
  name: string;
  local_port: number;
  region: string;
  server_address: string;
  public_url: string | null;
  status: string;
  error_message?: string;
}

export default function Dashboard({ credentials, onLogout }: DashboardProps) {
  const [instances, setInstances] = useState<TunnelInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadInstances = async () => {
    try {
      const data = await invoke<TunnelInstance[]>("list_instances");
      setInstances(data);
    } catch (error) {
      console.error("Failed to load instances:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadInstances();
  };

  const handleCreateInstance = () => {
    setShowCreateModal(true);
  };

  const handleInstanceCreated = () => {
    setShowCreateModal(false);
    loadInstances();
  };

  const handleStartTunnel = async (instanceId: string) => {
    try {
      await invoke("start_tunnel", { instanceId });
      await loadInstances();
    } catch (error) {
      console.error("Failed to start tunnel:", error);
      alert(`Failed to start tunnel: ${error}`);
    }
  };

  const handleStopTunnel = async (instanceId: string) => {
    try {
      await invoke("stop_tunnel", { instanceId });
      await loadInstances();
    } catch (error) {
      console.error("Failed to stop tunnel:", error);
      alert(`Failed to stop tunnel: ${error}`);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm("Are you sure you want to delete this instance?")) {
      return;
    }

    try {
      await invoke("delete_instance", { instanceId });
      await loadInstances();
    } catch (error) {
      console.error("Failed to delete instance:", error);
    }
  };

  const handleRenameInstance = async (instanceId: string, newName: string) => {
    try {
      await invoke("rename_instance", { instanceId, newName });
      await loadInstances();
    } catch (error) {
      console.error("Failed to rename instance:", error);
      alert("Failed to rename instance: " + error);
    }
  };

  const activeTunnels = instances.filter((i) => i.status === "active").length;

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-primary-100 rounded-lg">
              <svg
                className="w-6 h-6 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bore Tunnel</h1>
              <p className="text-sm text-gray-600">
                {activeTunnels} active tunnel{activeTunnels !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleCreateInstance}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Instance</span>
            </button>

            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">{credentials.email}</span>
            </div>

            <button
              onClick={onLogout}
              className="btn-secondary flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading instances...</p>
            </div>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No tunnel instances yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create your first tunnel instance to get started with exposing
                your local services to the internet.
              </p>
              <button
                onClick={handleCreateInstance}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create First Instance</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance) => (
              <TunnelCard
                key={instance.id}
                instance={instance}
                onStart={() => handleStartTunnel(instance.id)}
                onStop={() => handleStopTunnel(instance.id)}
                onDelete={() => handleDeleteInstance(instance.id)}
                onRename={(newName) => handleRenameInstance(instance.id, newName)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Instance Modal */}
      {showCreateModal && (
        <CreateInstanceModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleInstanceCreated}
        />
      )}
    </div>
  );
}
