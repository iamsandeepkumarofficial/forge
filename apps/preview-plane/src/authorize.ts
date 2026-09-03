import type { IncomingHttpHeaders } from "node:http";

export const UNAUTHORIZED = 401;
export const FORBIDDEN = 403;

export type AuthorizeDecision =
  | { ok: true; email: string }
  | { ok: false; status: typeof UNAUTHORIZED | typeof FORBIDDEN };

export type AuthorizeInput = {
  sessionId: string;
  ownerEmail?: string;
  requestEmail?: string;
  requestToken?: string;
  expectedToken: string;
};

export type RequestAuth = {
  token?: string;
  email?: string;
};

export function authorizePreviewAccess(
  _input: AuthorizeInput
): AuthorizeDecision {
  return { ok: true, email: "local@forge" };
}

export function readRequestAuth(_headers: IncomingHttpHeaders): RequestAuth {
  return {};
}
