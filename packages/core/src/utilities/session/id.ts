export function sanitizeSessionId(sessionId: string): string {
  const maxSessionIdLength = 200;
  return (
    sessionId.replace(/[^a-zA-Z0-9._/-]/g, "-").slice(0, maxSessionIdLength) ||
    "session"
  );
}
