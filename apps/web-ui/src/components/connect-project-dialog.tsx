import { useState } from "react";
import { connectProject, uploadProject } from "../lib/projects-api.js";
import { GithubRepoPicker } from "./github-repo-picker.js";

function ConnectProjectForm(options: {
  loading: boolean;
  connectingSlug: string | null;
  error: string | null;
  file: File | null;
  onFile: (file: File | null) => void;
  onClose: () => void;
  onShowGithub: () => void;
  onUpload: (e: React.FormEvent) => void;
}) {
  const {
    loading,
    connectingSlug,
    error,
    file,
    onFile,
    onClose,
    onShowGithub,
    onUpload
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
        <form onSubmit={onUpload}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Or upload a ZIP archive
            </label>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
              className="w-full"
            />
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
            <button
              type="submit"
              disabled={loading || !file}
              className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              {loading ? "Uploading..." : "Upload ZIP"}
            </button>
          </div>
        </form>
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
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGithubPicker, setShowGithubPicker] = useState(false);
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Select a ZIP archive or connect a GitHub repository.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await uploadProject(file);
      onConnected();
      onClose();
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
      onConnected();
      onClose();
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
        file={file}
        onFile={setFile}
        onClose={onClose}
        onShowGithub={() => {
          setError(null);
          setShowGithubPicker(true);
        }}
        onUpload={(e) => void handleUpload(e)}
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
