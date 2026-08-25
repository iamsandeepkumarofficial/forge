import type { NextFunction, Request, Response } from "express";
import type { User } from "@forge/db";
import { CatalogRepository } from "../catalog/repository.js";

const N_400 = 400;
const N_401 = 401;
const N_403 = 403;
const N_500 = 500;
const N_7 = 7;

const catalogRepository = new CatalogRepository();
export type AuthedRequest = Request & {
  forgeUser: User;
};
type AuthArgs = [Request, Response, NextFunction];
function resolveUserEmail(req: Request): string {
  const header = req.headers["x-forge-user-email"];
  const fromHeader = typeof header === "string" ? header.trim() : "";
  if (fromHeader) {
    return fromHeader;
  }
  return process.env.FORGE_WEB_UI_USER_EMAIL?.trim() || "dev@local.forge";
}
async function handlePocAuth(options: {
  req: Request;
  res: Response;
  next: NextFunction;
  expected: string;
}): Promise<void> {
  const { req, res, next, expected } = options;
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    res.status(N_401).json({ error: "missing Authorization: Bearer" });
    return;
  }
  const got = h.slice(N_7).trim();
  if (got !== expected) {
    res.status(N_403).json({ error: "invalid token" });
    return;
  }
  const email = resolveUserEmail(req);
  if (!email) {
    res.status(N_400).json({ error: "X-Forge-User-Email is required" });
    return;
  }
  try {
    const user = await catalogRepository.getOrCreateUser(email);
    (req as AuthedRequest).forgeUser = user;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(N_500).json({ error: message });
  }
}

/**
 * Loopback POC auth for local/desktop Forge.
 * Prefer env FORGE_POC_TOKEN. The Tauri desktop supervisor (RFC 0002) generates
 * a random high-entropy bearer token per launch and injects it into server + UI
 * env — never commit a shared token.
 */
export function createPocAuth(pocToken: string) {
  const expected = pocToken.trim();
  return async (...args: AuthArgs): Promise<void> => {
    const [req, res, next] = args;
    await handlePocAuth({ req, res, next, expected });
  };
}
