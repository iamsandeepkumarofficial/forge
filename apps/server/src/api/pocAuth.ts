import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { User } from "@forge/db";
import { getLocalUser } from "../catalog/localUser.js";

const N_500 = 500;

export type AuthedRequest = Request & {
  forgeUser: User;
};

type AuthArgs = [Request, Response, NextFunction];


export function formatAuthError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const nested =
    "errors" in err && Array.isArray((err as AggregateError).errors)
      ? (err as AggregateError).errors
          .map((e) => (e instanceof Error ? e.message : String(e)))
          .filter(Boolean)
      : [];
  const message = err.message.trim() || nested.join("; ");
  if (message) return message;
  const code =
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  if (code === "ECONNREFUSED") {
    return "Database connection refused. Is Postgres running (docker compose up -d postgres)?";
  }
  return code ? `Database error (${code})` : "Database request failed";
}


export function createLocalUserMiddleware(): RequestHandler {
  return async (...args: AuthArgs): Promise<void> => {
    const [req, res, next] = args;
    try {
      (req as AuthedRequest).forgeUser = await getLocalUser();
      next();
    } catch (err) {
      res.status(N_500).json({
        error: formatAuthError(err),
        help: "Check DATABASE_URL and that Postgres is up (default host port 5433)."
      });
    }
  };
}


export const createPocAuth = (_pocToken?: string): RequestHandler =>
  createLocalUserMiddleware();
