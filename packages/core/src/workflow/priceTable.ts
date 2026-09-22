export const PRICE_PER_MTOK_USD: Record<
  string,
  { input: number; output: number }
> = {
  default: { input: 3, output: 15 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet": { input: 3, output: 15 },
  "claude-haiku": { input: 0.8, output: 4 }
};

const TOKENS_PER_MILLION = 1_000_000;

export function estimateCostUsd(opts: {
  model?: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const key = (opts.model ?? "default").toLowerCase();
  const prices =
    PRICE_PER_MTOK_USD[key] ??
    Object.entries(PRICE_PER_MTOK_USD)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([k]) => key.includes(k))?.[1] ??
    PRICE_PER_MTOK_USD.default!;
  return (
    (opts.promptTokens / TOKENS_PER_MILLION) * prices.input +
    (opts.completionTokens / TOKENS_PER_MILLION) * prices.output
  );
}
