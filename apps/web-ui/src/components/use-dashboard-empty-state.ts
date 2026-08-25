import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SUGGESTION_SETS } from "./empty-state-shared.js";
import {
  connectGithubAndFinish,
  errorMessage,
  maybeCreateChat,
  uploadDroppedTransfer,
  uploadFolderList,
  uploadProject
} from "./dashboard-empty-uploads.js";

export function useDashboardEmptyState(options: { onConnected: () => void }) {
  const { onConnected } = options;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const importSectionRef = useRef<HTMLDivElement>(null);
  const [buildText, setBuildText] = useState("");
  const [pendingTitle, setPendingTitle] = useState("");
  const [suggestionSet, setSuggestionSet] = useState(0);
  const [showGithubPicker, setShowGithubPicker] = useState(false);
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [buildHint, setBuildHint] = useState(false);
  const [loading, setLoading] = useState<"github" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
  const withUpload = async (run: () => Promise<void>) => {
    setLoading("upload");
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
    setDragOver,
    importSectionRef,
    folderInputRef,
    finishConnect,
    withUpload
  });
  return {
    fileInputRef,
    folderInputRef,
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
    dragOver,
    setDragOver,
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
  setLoading: (v: "github" | "upload" | null) => void;
  setConnectingSlug: (v: string | null) => void;
  setDragOver: (v: boolean) => void;
  importSectionRef: React.RefObject<HTMLDivElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  finishConnect: (projectId: string) => Promise<void>;
  withUpload: (run: () => Promise<void>) => Promise<void>;
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
    handleZipFile: async (file: File | null | undefined) => {
      if (!file) return;
      await o.withUpload(async () => {
        const result = await uploadProject(file);
        await o.finishConnect(result.projectId);
      });
    },
    handleFolderFiles: async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      await o.withUpload(async () => {
        await uploadFolderList({ fileList, finishConnect: o.finishConnect });
        if (o.folderInputRef.current) o.folderInputRef.current.value = "";
      });
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      o.setDragOver(false);
      await o.withUpload(async () => {
        await uploadDroppedTransfer({
          dataTransfer: e.dataTransfer,
          finishConnect: o.finishConnect,
          onEmpty: () => o.setError("Drop a project folder or a .zip archive.")
        });
      });
    }
  };
}
