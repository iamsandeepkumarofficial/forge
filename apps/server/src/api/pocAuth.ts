import type { NextFunction, Request, Response } from "express";
import type { User } from "@forge/db";
import { getLocalUser } from "../catalog/localUser.js";

const N_500 = 500;

export type AuthedRequest = Request & {
  forgeUser: User;
};

type AuthArgs = [Request, Response, NextFunction];

/**
 * Attach the singleton local user (RFC 0004). No bearer token or email header.
 */
export function createLocalUserMiddleware() {
  return async (...args: AuthArgs): Promise<void> => {
    const [req, res, next] = args;
    try {
      (req as AuthedRequest).forgeUser = await getLocalUser();
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(N_500).json({ error: message });
    }
  };
}

/** @deprecated Use createLocalUserMiddleware — kept as alias during migration. */
export const createPocAuth = (_pocToken?: string) => createLocalUserMiddleware();
