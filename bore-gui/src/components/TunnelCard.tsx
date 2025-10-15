import { Play, Square, Trash2, Copy, ExternalLink, CheckCircle2, Edit2, Check, X } from "lucide-react";
import { TunnelInstance } from "./Dashboard";
import { useState } from "react";

interface TunnelCardProps {
  instance: TunnelInstance;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

export default function TunnelCard({
  instance,
  onStart,
  onStop,
  onDelete,
  onRename,
}: TunnelCardProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(instance.name);

  const isActive = instance.status === "active";
  const isStarting = instance.status === "starting";

  const handleCopyUrl = () => {
    if (instance.public_url) {
      navigator.clipboard.writeText(instance.public_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRename = () => {
    if (editName.trim() && editName !== instance.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(instance.name);
    setIsEditing(false);
  };

  const statusColor = {
    active: "bg-green-100 text-green-800 border-green-200",
    starting: "bg-yellow-100 text-yellow-800 border-yellow-200",
    error: "bg-red-100 text-red-800 border-red-200",
    inactive: "bg-gray-100 text-gray-800 border-gray-200",
  }[instance.status] || "bg-gray-100 text-gray-800 border-gray-200";

  const statusDot = {
    active: "bg-green-500",
    starting: "bg-yellow-500 animate-pulse",
    error: "bg-red-500",
    inactive: "bg-gray-400",
  }[instance.status] || "bg-gray-400";

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center space-x-2 mb-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="flex-1 px-2 py-1 text-lg font-semibold border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
              <button
                onClick={handleRename}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                title="Save"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {instance.name}
              </h3>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Rename instance"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
              <span className={`w-2 h-2 rounded-full mr-1.5 ${statusDot}`}></span>
              {instance.status.charAt(0).toUpperCase() + instance.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center text-sm">
          <span className="text-gray-500 w-24">Local Port:</span>
          <span className="text-gray-900 font-medium">{instance.local_port}</span>
        </div>
        {instance.remote_port !== undefined && (
          <div className="flex items-center text-sm">
            <span className="text-gray-500 w-24">Remote Port:</span>
            <span className="text-gray-900 font-medium">
              {instance.remote_port ?? "Assigning..."}
            </span>
          </div>
        )}
        <div className="flex items-center text-sm">
          <span className="text-gray-500 w-24">Region:</span>
          <span className="text-gray-900 font-medium">{instance.region}</span>
        </div>
        {instance.public_url && (
          <div className="flex items-center text-sm">
            <span className="text-gray-500 w-24">Public URL:</span>
            <div className="flex-1 flex items-center space-x-2">
              <span className="text-primary-600 font-medium truncate">
                {instance.public_url}
              </span>
              <button
                onClick={handleCopyUrl}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy URL"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <a
                href={`http://${instance.public_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Open in browser"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
        {instance.error_message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-medium text-red-800 mb-1">Error:</p>
            <p className="text-xs text-red-700 break-words whitespace-pre-wrap">
              {instance.error_message}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
        {isActive ? (
          <button
            onClick={onStop}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors duration-200"
          >
            <Square className="w-4 h-4" />
            <span className="font-medium">Stop</span>
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            <span className="font-medium">
              {isStarting ? "Starting..." : "Start"}
            </span>
          </button>
        )}
        
        <button
          onClick={onDelete}
          disabled={isStarting}
          className="px-4 py-2 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isActive ? "Stop and delete instance" : "Delete instance"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
