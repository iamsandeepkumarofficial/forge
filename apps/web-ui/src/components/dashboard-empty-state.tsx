import { DashboardEmptyStateView } from "./dashboard-empty-state-view.js";
import { useDashboardEmptyState } from "./use-dashboard-empty-state.js";

export function DashboardEmptyState(options: { onConnected: () => void }) {
  const state = useDashboardEmptyState(options);
  const { importSectionRef, ...viewState } = state;
  return (
    <DashboardEmptyStateView
      state={viewState}
      onImportSectionRef={(el) => {
        importSectionRef.current = el;
      }}
    />
  );
}
