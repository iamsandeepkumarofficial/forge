const ANSI_BY_CLASS: Record<string, string> = {
  "text-blue-400": "38;5;75",
  "text-green-400": "32",
  "text-purple-400": "35",
  "text-amber-400": "33",
  "text-pink-400": "95",
  "text-cyan-400": "36",
  "text-orange-400": "91"
};

export type XtermLogLine = {
  label: string;
  color: string;
  text: string;
};

export function xtermEmptyBuffer(noStreams: boolean): string {
  return noStreams
    ? "No output yet. Start an app from Run, or type a command below.\r\n"
    : "No output yet.\r\n";
}

export function formatXtermLine(line: XtermLogLine): string {
  const code = ANSI_BY_CLASS[line.color] ?? "36";
  return `\x1b[${code}m[${line.label}]\x1b[0m ${line.text}\r\n`;
}

export function formatXtermBuffer(lines: XtermLogLine[]): string {
  return lines.map(formatXtermLine).join("");
}

export function xtermWriteDelta(written: string, next: string): {
  reset: boolean;
  chunk: string;
} {
  if (next.startsWith(written)) {
    return { reset: false, chunk: next.slice(written.length) };
  }
  return { reset: true, chunk: next };
}
