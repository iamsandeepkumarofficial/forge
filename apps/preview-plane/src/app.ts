import express, { type Express } from "express";
import { createGateway } from "./gateway.js";
import { previewInternalRouter } from "./routes.js";
import { defaultRouteStore, type RouteStore } from "./routeStore.js";

export type PreviewAppOptions = {
  token?: string;
  store?: RouteStore;
  previewBaseDomain?: string;
  previewScheme?: string;
};

export function createPreviewApp(options: PreviewAppOptions = {}): Express {
  const token = options.token ?? process.env.FORGE_POC_TOKEN ?? "";
  const store = options.store ?? defaultRouteStore;
  const previewBaseDomain =
    options.previewBaseDomain ??
    process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim() ??
    "preview.forge.local";
  const previewScheme =
    options.previewScheme ?? process.env.PREVIEW_URL_SCHEME?.trim() ?? "https";
  const app = express();
  app.use(express.json());
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, mode: "preview-plane" });
  });
  app.use(
    "/internal",
    previewInternalRouter({ store, token, previewScheme, previewBaseDomain })
  );
  app.use(createGateway({ store, token }));
  return app;
}
