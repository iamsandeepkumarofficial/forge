import type { NextFunction, Request, Response } from "express";

const N_401 = 401;
const N_403 = 403;
const N_7 = 7;

type AuthArgs = [Request, Response, NextFunction];

function handlePocAuth(options: {
  req: Request;
  res: Response;
  next: NextFunction;
  expected: string;
}): void {
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
  next();
}

export function pocAuth(pocToken: string) {
  const expected = pocToken.trim();
  return (...args: AuthArgs): void => {
    const [req, res, next] = args;
    handlePocAuth({ req, res, next, expected });
  };
}
