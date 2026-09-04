import type { NextFunction, Request, Response } from "express";

type AuthArgs = [Request, Response, NextFunction];


export function pocAuth(_pocToken?: string) {
  return (...args: AuthArgs): void => {
    const [_req, _res, next] = args;
    next();
  };
}
