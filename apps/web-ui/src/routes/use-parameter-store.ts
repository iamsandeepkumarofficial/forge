import { useEffect, useState } from "react";
import {
  deleteWorkspaceParameter,
  listWorkspaceParameters,
  upsertWorkspaceParameter,
  type WorkspaceParameter
} from "../lib/workspaces-api.js";

function useParameterRows(workspaceId: string) {
  const [rows, setRows] = useState<WorkspaceParameter[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        setRows(await listWorkspaceParameters(workspaceId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const reload = async () => {
    setRows(await listWorkspaceParameters(workspaceId));
  };

  return { rows, error, setError, reload };
}

export function useParameterStore(workspaceId: string) {
  const { rows, error, setError, reload } = useParameterRows(workspaceId);
  const [busy, setBusy] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [draftSecret, setDraftSecret] = useState(false);

  const onSaveExisting = async (row: WorkspaceParameter, value: string) => {
    setBusy(true);
    setError(null);
    try {
      await upsertWorkspaceParameter(workspaceId, {
        key: row.key,
        value,
        secret: row.secret
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onAdd = async () => {
    const key = draftKey.trim();
    if (!key || busy) return;
    setBusy(true);
    setError(null);
    try {
      await upsertWorkspaceParameter(workspaceId, {
        key,
        value: draftValue,
        secret: draftSecret
      });
      setDraftKey("");
      setDraftValue("");
      setDraftSecret(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (key: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWorkspaceParameter(workspaceId, key);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return {
    rows,
    error,
    busy,
    draftKey,
    draftValue,
    draftSecret,
    setDraftKey,
    setDraftValue,
    setDraftSecret,
    onSaveExisting,
    onAdd,
    onDelete
  };
}
