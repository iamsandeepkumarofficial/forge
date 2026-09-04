import { createPreviewApp } from "@forge/preview-plane/app";

const N_8081 = 8081;

function truthyEnv(name: string): boolean | null {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return null;
}


export function previewInProcessEnabled(): boolean {
  const explicit = truthyEnv("PREVIEW_IN_PROCESS");
  if (explicit != null) return explicit;
  
  const url = process.env.PREVIEW_PLANE_URL?.trim() ?? "";
  if (url && !/127\.0\.0\.1|localhost/i.test(url)) return false;
  return true;
}

export function previewListenPort(): number {
  return Number(process.env.PREVIEW_PLANE_PORT || N_8081);
}


export function startInProcessPreview(bindHost: string): void {
  if (!previewInProcessEnabled()) return;

  const port = previewListenPort();
  const selfUrl = `http://127.0.0.1:${port}`;
  if (!process.env.PREVIEW_PLANE_URL?.trim()) {
    process.env.PREVIEW_PLANE_URL = selfUrl;
  }
  if (!process.env.PREVIEW_PUBLIC_ORIGIN?.trim()) {
    process.env.PREVIEW_PUBLIC_ORIGIN = selfUrl;
  }
  if (!process.env.PREVIEW_URL_SCHEME?.trim()) {
    process.env.PREVIEW_URL_SCHEME = "http";
  }
  if (!process.env.FORGE_PREVIEW_BASE_DOMAIN?.trim()) {
    process.env.FORGE_PREVIEW_BASE_DOMAIN = "preview.localhost";
  }

  const app = createPreviewApp();
  app.listen(port, bindHost, () => {
    process.stdout.write(
      `Forge preview proxy (in-process) listening on http://${bindHost}:${port}\n`
    );
  });
}
