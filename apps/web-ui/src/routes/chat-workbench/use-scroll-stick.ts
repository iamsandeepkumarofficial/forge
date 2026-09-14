import { useEffect, useRef } from "react";

export function useScrollStick(options: {
  messageCount: number;
  streamingText: string;
  streamingReasoning?: string;
  isStreaming: boolean;
  toolPartCount: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [
    options.messageCount,
    options.streamingText,
    options.streamingReasoning,
    options.isStreaming,
    options.toolPartCount
  ]);
  return { scrollerRef, stickToBottomRef };
}
