import type { IncomingHttpHeaders } from "node:http";
import { stripBearer } from "./hostnames.js";

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

export function authorizePreviewAccess(
  input: AuthorizeInput
): AuthorizeDecision {
  if (!input.requestToken || input.requestToken !== input.expectedToken) {
    return { ok: false, status: N_401 };
  }
  if (!input.requestEmail) {
    return { ok: false, status: N_401 };
  }
  if (input.ownerEmail && input.ownerEmail !== input.requestEmail) {
    return { ok: false, status: N_403 };
  }
  return { ok: true, email: input.requestEmail };
}

export function readRequestAuth(headers: IncomingHttpHeaders): RequestAuth {
  const rawAuth = headers.authorization;
  const authorization = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  const tokenFromHeader = stripBearer(authorization);
  const cookieHeader = headers.cookie;
  const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  const cookieMatch = cookie
    ? /(?:^|;\s*)forge_token=([^;]+)/.exec(cookie)
    : null;
  const rawEmail = headers["x-forge-user-email"];
  const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  return {
    token: tokenFromHeader ?? cookieMatch?.[1],
    email: email?.trim() || undefined
  };
}
