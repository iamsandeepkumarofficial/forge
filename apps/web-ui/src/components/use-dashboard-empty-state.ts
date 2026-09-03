import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isDesktop, pickFolder } from "../lib/desktop.js";
import { SUGGESTION_SETS } from "./empty-state-shared.js";
import {
  connectLocalAndFinish,
  errorMessage,
  maybeCreateChat
} from "./dashboard-empty-connect.js";

export function useDashboardEmptyState(options: { onConnected: () => void }) {
  const { onConnected } = options;
  const navigate = useNavigate();
  const importSectionRef = useRef<HTMLDivElement>(null);
  const [buildText, setBuildText] = useState("");
  const [pendingTitle, setPendingTitle] = useState("");
  const [suggestionSet, setSuggestionSet] = useState(0);
  const [buildHint, setBuildHint] = useState(false);
  const [loading, setLoading] = useState<"local" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desktop] = useState(() => isDesktop());
  const [showPathInput, setShowPathInput] = useState(() => !isDesktop());
  const [localPath, setLocalPath] = useState("");
  const suggestions = SUGGESTION_SETS[suggestionSet % SUGGESTION_SETS.length]!;
  const finishConnect = useCallback(
    async (projectId: string) => {
      await maybeCreateChat({
        projectId,
        title: (pendingTitle || buildText).trim()
      });
      onConnected();
      void navigate(`/projects/${projectId}`);
    },
    [buildText, navigate, onConnected, pendingTitle]
  );
  const withLocal = async (run: () => Promise<void>) => {
    setLoading("local");
    setError(null);
    try {
      await run();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(null);
    }
  };
  const handleBuild = () => {
    setPendingTitle(buildText.trim() || "New Chat");
    setBuildHint(true);
    setError(null);
    importSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };
  const handleSelectFolder = async () => {
    setError(null);
    if (!desktop) {
      setShowPathInput(true);
      return;
    }
    await withLocal(async () => {
      const path = await pickFolder();
      if (!path) return;
      await connectLocalAndFinish({
        localPath: path,
        finishConnect
      });
    });
  };
  const handleConnectPath = async () => {
    const trimmed = localPath.trim();
    if (!trimmed) {
      setError("Enter an absolute path to a project folder.");
      return;
    }
    await withLocal(async () => {
      await connectLocalAndFinish({
        localPath: trimmed,
        finishConnect
      });
    });
  };
  return {
    importSectionRef,
    buildText,
    setBuildText,
    pendingTitle,
    suggestions,
    buildHint,
    loading,
    error,
    setError,
    desktop,
    showPathInput,
    localPath,
    setLocalPath,
    setSuggestionSet,
    busy: loading !== null,
    handleBuild,
    handleSelectFolder,
    handleConnectPath
  };
}
