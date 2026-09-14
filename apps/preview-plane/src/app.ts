import express, { type Express } from "express";
import type { Server } from "node:http";
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
    res.json({ ok: true, mode: "network-plane" });
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
  const gateway = createGateway({ store, token: "" });
  app.use(gateway.web);
  const listen = app.listen.bind(app);
  app.listen = ((...args: unknown[]) => {
    const server = (listen as (...listenArgs: unknown[]) => Server)(...args);
    server.on("upgrade", (req, ...rest) => {
      gateway.upgrade({ req, socket: rest[0], head: rest[1] });
    });
    return server;
  }) as Express["listen"];
  return app;
}
