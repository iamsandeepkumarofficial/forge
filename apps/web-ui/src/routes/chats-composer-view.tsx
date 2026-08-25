import { ArrowUp, Loader2 } from "lucide-react";
import { ModePicker, ModelPicker } from "../components/chat-composer.js";
import type { ChatsPageState } from "./use-chats-page.js";

export function ChatsComposerForm({ state }: { state: ChatsPageState }) {
  const {
    prompt,
    setPrompt,
    creating,
    textareaRef,
    startChat,
    agentMode,
    setAgentMode,
    provider,
    activeModel,
    autoModel,
    modelsByProvider,
    modelsLoading,
    setAutoModel,
    onModelSelect
  } = state;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void startChat(prompt);
      }}
      className="rounded-2xl border border-border bg-background shadow-sm"
    >
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void startChat(prompt);
          }
        }}
        placeholder="Ask Forge to build…"
        rows={3}
        disabled={creating}
        className="w-full resize-none bg-transparent px-4 pt-4 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <div className="flex items-center gap-2 px-3 pb-3">
        <ModePicker value={agentMode} onChange={setAgentMode} />
        <ModelPicker
          provider={provider}
          model={activeModel}
          auto={autoModel}
          modelsByProvider={modelsByProvider}
          loading={modelsLoading}
          onAutoChange={setAutoModel}
          onSelect={onModelSelect}
        />
        <div className="flex-1" />
        <button
          type="submit"
          disabled={creating || !prompt.trim()}
          className="inline-flex size-9 items-center justify-center rounded-xl bg-foreground text-background disabled:opacity-40"
          aria-label="Start chat"
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>
    </form>
  );
}

export function ChatsComposerView({ state }: { state: ChatsPageState }) {
  const { sessions, error, setSearchParams } = state;
  return (
    <div className="flex h-full min-h-0 flex-col">
      {sessions.length > 0 ? (
        <div className="flex justify-end px-6 pt-4">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setSearchParams({})}
          >
            View existing chats
          </button>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-2xl space-y-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            What do you want to create?
          </h2>
          <ChatsComposerForm state={state} />
          {error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Opens a chat with its own branch and sandbox in this workspace.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
