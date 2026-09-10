export type AgentPromptMessage = {
  text: string;

  replaceRunning?: boolean;
};

type Handler = (msg: AgentPromptMessage) => void;

const handlers = new Set<Handler>();

export function onAgentPrompt(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function postAgentPrompt(msg: AgentPromptMessage): void {
  const text = msg.text.trim();
  if (!text) return;
  for (const handler of handlers) handler({ ...msg, text });
}

export function onPreviewChatMessage(
  handler: (text: string) => void
): () => void {
  return onAgentPrompt((msg) => handler(msg.text));
}

export function postPreviewChatMessage(text: string): void {
  postAgentPrompt({ text });
}
