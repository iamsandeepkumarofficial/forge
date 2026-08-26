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
  const store = options.store ?? defaultRouteStore;
  const previewBaseDomain =
    options.previewBaseDomain ??
    process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim() ??
    (/localhost|127\.0\.0\.1/i.test(
      process.env.PREVIEW_PUBLIC_ORIGIN?.trim() ||
        process.env.PREVIEW_PLANE_URL?.trim() ||
        ""
    )
      ? "preview.localhost"
      : "preview.forge.local");
  const previewScheme =
    options.previewScheme ?? process.env.PREVIEW_URL_SCHEME?.trim() ?? "http";
  const app = express();
  app.use(express.json());
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, mode: "preview-plane" });
  });
  app.use(
    "/internal",
    previewInternalRouter({
      store,
      token: "",
      previewScheme,
      previewBaseDomain
    })
  );
  app.use(createGateway({ store, token: "" }));
  return app;
}
