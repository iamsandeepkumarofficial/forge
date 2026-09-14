# RFC 0009: SandboxRuntime Port Adapters

- **Status:** Accepted
- **Date:** 2026-09-10
- **Authors:** Forge contributors
- **Depends on:** [RFC 0006](./0006-local-host-runtime-zero-docker.md)
- **Amends:** RFC 0006 (preview/ports section — concrete adapter ownership)

## Summary

Listen ports, published (machine-reachable) ports, readiness repair, and `FORGE_PUBLISHED_APP_PORTS` are owned by each **`SandboxRuntime` adapter**. Callers (`appRunner`, background jobs, status) resolve the runtime via `getSandboxRuntime(sessionId)` and never branch on `isHostSession` for port mapping.

| Runtime        | Listen (`PORT`)                     | Published (readiness / local URL)               | Repair                       |
| -------------- | ----------------------------------- | ----------------------------------------------- | ---------------------------- |
| **Host**       | Session port registry `40000–49999` | Same as listen                                  | TCP wait only                |
| **Docker**     | Reserved `3000–3009` in container   | `hostPortForContainerPort` (session host block) | Docker `-p` repair + restart |
| **Kubernetes** | Reserved `3000–3009` in pod         | Same as listen (cluster service)                | TCP wait only                |

## Motivation

A shared `publishedHostPort` helper mixed Docker publish mapping into host sessions: readiness probed mapped `41xxx` while the process listened on `3000`, so Forge SIGTERM’d healthy apps. Treating `3000–3009` as host listen ports also collides across sessions and contradicts RFC 0006’s registry model. Cloud constants must not decide host listen behavior.

## Goals

1. Extend `SandboxRuntime` with `resolveListenPort`, `resolvePublishedPort`, `ensurePublishedPortReady`, and `publishedAppPortsEnv`.
2. Host: wire `allocateSessionPort` into app start; inject registry ports as `PORT`.
3. Docker: keep `3000–3009` + `hostPortForContainerPort` **docker-only** (no host branch in `sessionSandbox/constants`).
4. Remove mixed `publishedHostPort` / `isHostSession` port branching from app runner.

## Non-goals

- Rewriting all remaining `hostMode` leaks (provision mounts, FS tools, appDb).
- Changing preview-plane hostname scheme beyond primary vs port-qualified selection on host.
- Multi-tenant collision-free ports across machines (single desktop host only).

## API

```ts
resolveListenPort(input: {
  sessionId: string;
  appName: string;
  preferred?: number;
  usedListenPorts: number[];
}): Promise<number>;

resolvePublishedPort(
  sessionId: string,
  listenPort: number
): Promise<number | null>;

ensurePublishedPortReady(input: {
  handle: WorkspaceHandle;
  listenPort: number;
  publishedPort: number;
  onRepairRestart?: () => Promise<boolean>;
}): Promise<boolean>;

publishedAppPortsEnv(): string;
```

### Host adapter

- Preferred in `40000–49999` → reuse via registry when free for the session.
- Preferred in `3000–3009` (legacy / agent habit) → ignore and allocate a registry port.
- `resolvePublishedPort` = identity.
- Preview backend: `127.0.0.1:${listenPort}`.
- Primary session hostname for the lowest allocated session port; otherwise port-qualified.

### Docker adapter

- Preferred must be in `3000–3009` (or allocate next free reserved).
- Published = mapped host port; readiness waits on published; miss → repair bindings + optional restart.

## Call sites

- `runApp`: resolve listen → persist → inject `PORT` → process TCP on listen → `ensurePublishedPortReady` → `publishPreviewPort`.
- `statusForApp`: `hostPort` from `resolvePublishedPort`; preview URL hostname from `previewHostname` (must match publish).
- `registerWorkspaceGateway`: uses the catch-all app’s **listen** port + `previewHostname` (never hardcode `3000` on host).
- `upsertLaunchApp` / `resolveLaunchPort`: validate against the session runtime’s allowed range (or remap via `resolveListenPort` on host).
- `startBackgroundJob`: `FORGE_PUBLISHED_APP_PORTS` from `publishedAppPortsEnv()`.

## Consequences

- Host and cloud port schemes cannot regress into each other without changing an adapter.
- Launch.json on host stores registry ports after first resolve (not shared `3000`).
- Agent prompts for host should describe `40000–49999` / honor `PORT`, not Docker’s published range.

## References

- [RFC 0006: Local Host Runtime and Zero-Docker Desktop](./0006-local-host-runtime-zero-docker.md)
