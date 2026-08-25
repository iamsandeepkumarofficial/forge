import { NewChatDialogView } from "./new-chat-dialog-view.js";
import { useNewChatDialog } from "./use-new-chat-dialog.js";
import type { NewChatDialogProps } from "./new-chat-dialog-shared.js";

export type { ChatPriority } from "./new-chat-dialog-shared.js";

export function NewChatDialog(props: NewChatDialogProps) {
  const state = useNewChatDialog(props);
  return <NewChatDialogView state={state} />;
}
