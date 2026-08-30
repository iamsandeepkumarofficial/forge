type Handler = (text: string) => void;

const handlers = new Set<Handler>();

export function onPreviewChatMessage(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function postPreviewChatMessage(text: string): void {
  for (const handler of handlers) handler(text);
}
