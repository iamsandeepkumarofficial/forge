import type { NextFunction, Request, Response } from "express";

type AuthArgs = [Request, Response, NextFunction];

/** Internal routes are open on loopback (RFC 0004 — no POC token). */
export function pocAuth(_pocToken?: string) {
  return (...args: AuthArgs): void => {
    const [_req, _res, next] = args;
    next();
  };
}
