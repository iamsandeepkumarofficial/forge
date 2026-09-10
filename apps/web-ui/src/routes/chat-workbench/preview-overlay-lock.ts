import { useEffect, useState } from "react";

let depth = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function acquirePreviewOverlayLock(): () => void {
  depth += 1;
  notify();
  return () => {
    depth = Math.max(0, depth - 1);
    notify();
  };
}

export function previewOverlayLocked(): boolean {
  return depth > 0;
}

export function usePreviewOverlayLocked(): boolean {
  const [locked, setLocked] = useState(() => depth > 0);
  useEffect(() => {
    const onChange = () => setLocked(depth > 0);
    listeners.add(onChange);
    onChange();
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return locked;
}

export function resetPreviewOverlayLockForTests(): void {
  depth = 0;
  notify();
}
