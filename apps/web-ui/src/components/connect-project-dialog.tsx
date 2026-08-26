import { useState } from "react";
import { isDesktop, pickFolder } from "../lib/desktop.js";
import { connectLocalProject, connectProject } from "../lib/projects-api.js";
import { GithubRepoPicker } from "./github-repo-picker.js";

function ConnectProjectForm(options: {
  loading: boolean;
  connectingSlug: string | null;
  error: string | null;
  desktop: boolean;
  showPathInput: boolean;
  localPath: string;
  onLocalPath: (path: string) => void;
  onClose: () => void;
  onShowGithub: () => void;
  onSelectFolder: () => void;
  onConnectPath: (e: React.FormEvent) => void;
}) {
  const {
    loading,
    connectingSlug,
    error,
    desktop,
    showPathInput,
    localPath,
    onLocalPath,
    onClose,
    onShowGithub,
    onSelectFolder,
    onConnectPath
  } = options;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Connect a workspace</h2>
        <div className="mb-4 space-y-2">
          <button
            type="button"
            disabled={loading || Boolean(connectingSlug)}
            onClick={onShowGithub}
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
          >
            Continue with GitHub
          </button>
          <p className="text-xs text-muted-foreground">
            Authorize GitHub, then pick a repository from your account.
          </p>
        </div>
        <div className="mb-4 space-y-2">
          <button
            type="button"
            disabled={loading || Boolean(connectingSlug)}
            onClick={onSelectFolder}
            className="w-full rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Select folder"}
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
                className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {loading ? "Connecting..." : "Connect"}
              </button>
            </form>
          )}
          <p className="text-xs text-muted-foreground">
            {desktop
              ? "Opens a native folder picker."
              : "Native folder picker requires the desktop app."}
          </p>
        </div>
        {error && <p className="text-destructive mb-4 text-sm">{error}</p>}
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
  const [showGithubPicker, setShowGithubPicker] = useState(false);
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);

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

  const handleGithubSelect = async (fullName: string) => {
    setConnectingSlug(fullName);
    setError(null);
    try {
      await connectProject(fullName);
      setShowGithubPicker(false);
      finish();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnectingSlug(null);
    }
  };

  return (
    <>
      <ConnectProjectForm
        loading={loading}
        connectingSlug={connectingSlug}
        error={error}
        desktop={desktop}
        showPathInput={showPathInput}
        localPath={localPath}
        onLocalPath={setLocalPath}
        onClose={onClose}
        onShowGithub={() => {
          setError(null);
          setShowGithubPicker(true);
        }}
        onSelectFolder={() => void handleSelectFolder()}
        onConnectPath={(e) => void handleConnectPath(e)}
      />
      <GithubRepoPicker
        open={showGithubPicker}
        onClose={() => {
          if (!connectingSlug) setShowGithubPicker(false);
        }}
        onSelect={handleGithubSelect}
        connectingSlug={connectingSlug}
      />
    </>
  );
}
