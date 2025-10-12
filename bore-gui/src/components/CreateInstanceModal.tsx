import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { X, Loader2, Folder } from "lucide-react";

interface CreateInstanceModalProps {
  onClose: () => void;
  onCreate: () => void;
}

export default function CreateInstanceModal({
  onClose,
  onCreate,
}: CreateInstanceModalProps) {
  const [name, setName] = useState(`code-server-${Date.now()}`);
  const [projectPath, setProjectPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });
      if (selected && typeof selected === "string") {
        setProjectPath(selected);
      }
    } catch (err: any) {
      console.error("Failed to select folder:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!projectPath) {
      setError("Please select a project folder");
      return;
    }

    setLoading(true);

    try {
      // Find available port
      const availablePort = await invoke<number>("find_available_port_command", { 
        startPort: 8081 
      });
      
      // Start code-server instance with project folder
      await invoke("start_code_server_instance", {
        port: availablePort,
        instanceName: name,
        projectPath: projectPath,
      });
      
      onCreate();
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Create New Tunnel Instance
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instance Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="my-code-server"
              required
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              A friendly name to identify your code-server instance
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Folder
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={projectPath}
                readOnly
                className="input-field flex-1 bg-gray-50"
                placeholder="Select a folder for your project"
                required
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                disabled={loading}
                className="btn-secondary flex items-center space-x-2 whitespace-nowrap"
              >
                <Folder className="w-4 h-4" />
                <span>Browse</span>
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              The folder where code-server will open your project
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Auto-configured:</strong> Port will be automatically selected starting from 8081. 
              Code-server and bore tunnel will start automatically.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Instance</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
