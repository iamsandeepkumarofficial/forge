import { TicketMetadataPanelView } from "./ticket-metadata-panel-view.js";
import { useTicketMetadataPanel } from "./use-ticket-metadata-panel.js";
import type { TicketMetadataPanelProps } from "./ticket-metadata-shared.js";

export type { TicketSummary } from "./ticket-metadata-shared.js";

export function TicketMetadataPanel({
  projectId,
  chat,
  allChats,
  onUpdated,
  hideHeading = false
}: TicketMetadataPanelProps) {
  const state = useTicketMetadataPanel({
    projectId,
    chat,
    allChats,
    onUpdated
  });
  return <TicketMetadataPanelView state={state} hideHeading={hideHeading} />;
}
