import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isDesktop, pickFolder } from "../lib/desktop.js";
import { SUGGESTION_SETS } from "./empty-state-shared.js";
import {
  connectGithubAndFinish,
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
  const [showGithubPicker, setShowGithubPicker] = useState(false);
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [buildHint, setBuildHint] = useState(false);
  const [loading, setLoading] = useState<"github" | "local" | null>(null);
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
  const actions = useDashboardEmptyActions({
    buildText,
    setPendingTitle,
    setBuildHint,
    setShowGithubPicker,
    setError,
    setLoading,
    setConnectingSlug,
    setShowPathInput,
    desktop,
    localPath,
    importSectionRef,
    finishConnect,
    withLocal
  });
  return {
    importSectionRef,
    buildText,
    setBuildText,
    pendingTitle,
    suggestions,
    showGithubPicker,
    setShowGithubPicker,
    connectingSlug,
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
    ...actions
  };
}

function useDashboardEmptyActions(options: {
  buildText: string;
  setPendingTitle: (v: string) => void;
  setBuildHint: (v: boolean) => void;
  setShowGithubPicker: (v: boolean) => void;
  setError: (v: string | null) => void;
  setLoading: (v: "github" | "local" | null) => void;
  setConnectingSlug: (v: string | null) => void;
  setShowPathInput: (v: boolean) => void;
  desktop: boolean;
  localPath: string;
  importSectionRef: React.RefObject<HTMLDivElement | null>;
  finishConnect: (projectId: string) => Promise<void>;
  withLocal: (run: () => Promise<void>) => Promise<void>;
}) {
  const o = options;
  return {
    handleBuild: () => {
      o.setPendingTitle(o.buildText.trim() || "New Chat");
      o.setBuildHint(true);
      o.setShowGithubPicker(true);
      o.setError(null);
      o.importSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    },
    handleGithubSelect: async (fullName: string) => {
      o.setLoading("github");
      o.setConnectingSlug(fullName);
      o.setError(null);
      try {
        await connectGithubAndFinish({
          fullName,
          finishConnect: o.finishConnect
        });
        o.setShowGithubPicker(false);
      } catch (err) {
        o.setError(errorMessage(err));
      } finally {
        o.setConnectingSlug(null);
        o.setLoading(null);
      }
    },
    handleSelectFolder: async () => {
      o.setError(null);
      if (!o.desktop) {
        o.setShowPathInput(true);
        return;
      }
      await o.withLocal(async () => {
        const path = await pickFolder();
        if (!path) return;
        await connectLocalAndFinish({
          localPath: path,
          finishConnect: o.finishConnect
        });
      });
    },
    handleConnectPath: async () => {
      const trimmed = o.localPath.trim();
      if (!trimmed) {
        o.setError("Enter an absolute path to a project folder.");
        return;
      }
      await o.withLocal(async () => {
        await connectLocalAndFinish({
          localPath: trimmed,
          finishConnect: o.finishConnect
        });
      });
    }
  };
}
