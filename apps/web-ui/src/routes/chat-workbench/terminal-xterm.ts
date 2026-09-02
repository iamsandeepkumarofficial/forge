export function xtermWriteDelta(written: string, next: string): {
  reset: boolean;
  chunk: string;
} {
  if (next.startsWith(written)) {
    return { reset: false, chunk: next.slice(written.length) };
  }
  return { reset: true, chunk: next };
}
