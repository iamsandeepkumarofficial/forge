import type { IncomingHttpHeaders } from "node:http";

const N_401 = 401;
const N_403 = 403;

export type AuthorizeDecision =
  | { ok: true; email: string }
  | { ok: false; status: typeof N_401 | typeof N_403 };

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

/** Preview gateway is open on loopback (RFC 0004 — no token/email). */
export function authorizePreviewAccess(
  _input: AuthorizeInput
): AuthorizeDecision {
  return { ok: true, email: "local@forge" };
}

export function readRequestAuth(_headers: IncomingHttpHeaders): RequestAuth {
  return {};
}
