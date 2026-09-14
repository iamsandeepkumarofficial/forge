export function clearPreviewHistoryTo(options: {
  current: string;
  setHistory: (v: string[]) => void;
  setHistIndex: (v: number) => void;
  setAddress: (v: string) => void;
}) {
  options.setHistory([options.current]);
  options.setHistIndex(0);
  options.setAddress(options.current);
}
