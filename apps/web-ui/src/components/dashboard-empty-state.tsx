import { DashboardEmptyStateView } from "./dashboard-empty-state-view.js";
import { useDashboardEmptyState } from "./use-dashboard-empty-state.js";

export function DashboardEmptyState(options: {
  onConnected: () => void;
  onShowActivity?: () => void;
}) {
  const { onShowActivity, ...emptyOptions } = options;
  const state = useDashboardEmptyState(emptyOptions);
  const { importSectionRef, ...viewState } = state;
  return (
    <DashboardEmptyStateView
      state={viewState}
      onShowActivity={onShowActivity}
      onImportSectionRef={(el) => {
        importSectionRef.current = el;
      }}
    />
  );
}
