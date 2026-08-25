export function usableInputTokens(options: {
  contextWindow: number | null;
  maxOutputTokens: number | null;
}): number | null {
  if (options.contextWindow == null || options.contextWindow <= 0) {
    return null;
  }
  const reserved =
    options.maxOutputTokens != null &&
    options.maxOutputTokens > 0 &&
    options.maxOutputTokens < options.contextWindow
      ? options.maxOutputTokens
      : 0;
  return options.contextWindow - reserved;
}
