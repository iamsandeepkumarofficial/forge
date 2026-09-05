import type { WorkspaceRoute } from "@forge/db";
import { WorkspaceService } from "../../services/workspace/workspace.service.js";
import { ChatFeatureService } from "../../projects/chatFeatureService.js";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";

export const N_201 = 201;
export const N_202 = 202;
export const N_204 = 204;
export const N_400 = 400;
export const N_403 = 403;
export const N_404 = 404;
export const N_409 = 409;
export const N_500 = 500;

export const workspaceService = new WorkspaceService();
export const chatFeatureService = new ChatFeatureService();
export const chatRepo = new ChatFeatureRepository();

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function statusFromError(error: unknown): number {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  const msg = errorMessage(error).toLowerCase();
  if (msg.includes("not found")) return N_404;
  if (msg.includes("forbidden")) return N_403;
  if (msg.includes("already")) return N_409;
  if (
    msg.includes("required") ||
    msg.includes("invalid") ||
    msg.includes("cycle") ||
    msg.includes("must") ||
    msg.includes("exactly one")
  ) {
    return N_400;
  }
  return N_500;
}

export type { WorkspaceRoute };
