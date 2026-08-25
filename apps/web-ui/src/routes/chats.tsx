import { ChatsComposerView } from "./chats-composer-view.js";
import { ChatsListView } from "./chats-list-view.js";
import { useChatsPage } from "./use-chats-page.js";

export function ChatsPage() {
  const state = useChatsPage();
  if (state.loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Loading chats…
      </div>
    );
  }
  if (state.showComposer) {
    return <ChatsComposerView state={state} />;
  }
  return <ChatsListView state={state} />;
}
