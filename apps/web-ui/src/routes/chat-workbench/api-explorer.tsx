import { apiBaseUrl, operationKey } from "./api-explorer-model.js";
import {
  ApiRequestForm,
  ApiResponseView,
  EndpointList
} from "./api-explorer-panels.js";
import { useApiExplorer } from "./use-api-explorer.js";
import type { AppStatus } from "../../lib/tool-runner.js";

export function ApiExplorer(options: {
  sessionId: string;
  app: AppStatus | undefined;
  path?: string;
  onPath?: (path: string) => void;
}) {
  const { app } = options;
  const base = app ? apiBaseUrl(app) : "";
  const state = useApiExplorer(options);

  if (!app) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No API selected.</p>
    );
  }
  if (!base) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {app.name} is running but has no reachable URL. Forge only publishes
        ports 3000–3009.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <EndpointList
        ops={state.ops}
        scanning={state.scanning}
        activeKey={operationKey({ method: state.method, path: state.path })}
        onPick={state.pick}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ApiRequestForm
          method={state.method}
          path={state.path}
          headerText={state.headerText}
          body={state.body}
          busy={state.busy}
          onMethod={state.setMethod}
          onPath={state.setPath}
          onHeaderText={state.setHeaderText}
          onBody={state.setBody}
          onSend={() => void state.send()}
        />
        <ApiResponseView error={state.error} result={state.result} />
      </div>
    </div>
  );
}
