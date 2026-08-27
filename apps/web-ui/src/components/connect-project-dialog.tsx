import { useState } from "react";
import { Folder, Loader2 } from "lucide-react";
import { isDesktop, pickFolder } from "../lib/desktop.js";
import { connectLocalProject } from "../lib/projects-api.js";

function ConnectProjectForm(options: {
  loading: boolean;
  error: string | null;
  desktop: boolean;
  showPathInput: boolean;
  localPath: string;
  onLocalPath: (path: string) => void;
  onClose: () => void;
  onSelectFolder: () => void;
  onConnectPath: (e: React.FormEvent) => void;
}) {
  const {
    loading,
    error,
    desktop,
    showPathInput,
    localPath,
    onLocalPath,
    onClose,
    onSelectFolder,
    onConnectPath
  } = options;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6">
        <h2 className="mb-4 text-xl font-semibold">Connect a project</h2>
        <div className="mb-4 space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={onSelectFolder}
            aria-label="Select folder"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Folder className="size-4" />
            )}
            Select folder
          </button>
          {showPathInput && !desktop && (
            <form onSubmit={onConnectPath} className="space-y-2">
              <label className="block text-sm font-medium">
                Absolute folder path
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => onLocalPath(e.target.value)}
                  placeholder="/Users/you/projects/my-app"
                  disabled={loading}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </label>
              <button
                type="submit"
                disabled={loading || !localPath.trim()}
                aria-label="Connect folder"
                className="inline-flex w-full items-center justify-center rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Folder className="size-4" />
                )}
              </button>
            </form>
          )}
          <p className="text-xs text-muted-foreground">
            {desktop
              ? "Opens a native folder picker."
              : "Native folder picker requires the desktop app."}
          </p>
        </div>
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConnectProjectDialog({
  onClose,
  onConnected
}: {
  onClose: () => void;
  onConnected: () => void;
}) {
  const [desktop] = useState(() => isDesktop());
  const [showPathInput, setShowPathInput] = useState(() => !isDesktop());
  const [localPath, setLocalPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    onConnected();
    onClose();
  };

  const handleSelectFolder = async () => {
    setError(null);
    if (!desktop) {
      setShowPathInput(true);
      return;
    }
    setLoading(true);
    try {
      const path = await pickFolder();
      if (!path) return;
      await connectLocalProject(path);
      finish();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPath = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = localPath.trim();
    if (!trimmed) {
      setError("Enter an absolute path to a project folder.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await connectLocalProject(trimmed);
      finish();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConnectProjectForm
      loading={loading}
      error={error}
      desktop={desktop}
      showPathInput={showPathInput}
      localPath={localPath}
      onLocalPath={setLocalPath}
      onClose={onClose}
      onSelectFolder={() => void handleSelectFolder()}
      onConnectPath={(e) => void handleConnectPath(e)}
    />
  );
}
