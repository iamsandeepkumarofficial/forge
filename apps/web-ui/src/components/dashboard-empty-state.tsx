import { DashboardEmptyStateView } from "./dashboard-empty-state-view.js";
import { useDashboardEmptyState } from "./use-dashboard-empty-state.js";

export function DashboardEmptyState(options: { onConnected: () => void }) {
  const state = useDashboardEmptyState(options);
  const {
    fileInputRef,
    folderInputRef,
    importSectionRef,
    handleZipFile,
    handleFolderFiles,
    ...viewState
  } = state;
  return (
    <>
      <DashboardEmptyStateView
        state={viewState}
        onImportSectionRef={(el) => {
          importSectionRef.current = el;
        }}
        onChooseZip={() => fileInputRef.current?.click()}
        onChooseFolder={() => folderInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          void handleZipFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => void handleFolderFiles(e.target.files)}
      />
    </>
  );
}
