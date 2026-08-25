import {
  WorkbenchCreateForm,
  WorkbenchSessionList
} from "./workbench-sessions-parts.js";
import { useWorkbenchSessions } from "./use-workbench-sessions.js";

interface WorkbenchSessionsDialogProps {
  projectId: string;
  onClose: () => void;
}

export function WorkbenchSessionsDialog({
  projectId,
  onClose
}: WorkbenchSessionsDialogProps) {
  const state = useWorkbenchSessions({ projectId, onClose });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background shadow-lg"
        role="dialog"
        aria-labelledby="workbench-dialog-title"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="workbench-dialog-title" className="text-lg font-semibold">
            Project workbench
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <WorkbenchCreateForm
          title={state.title}
          creating={state.creating}
          onTitleChange={state.setTitle}
          onSubmit={(e) => void state.handleCreate(e)}
        />
        <WorkbenchSessionList
          loading={state.loading}
          sessions={state.sessions}
          deletingId={state.deletingId}
          onResume={state.handleResume}
          onDelete={(sessionId, sessionTitle) =>
            void state.handleDelete(sessionId, sessionTitle)
          }
        />
        {state.error && (
          <p className="border-t px-4 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
