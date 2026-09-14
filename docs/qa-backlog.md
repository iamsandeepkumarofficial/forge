# QA backlog

## Backend crash loop when Mongo is down (2026-08-31)

**Observed:** User stopped the Mongo container. The backend app kept crashing but did not auto-restart / recover when Mongo came back.

**Scope:** Out of terminal work — investigate app runner / `preview_start` health and restart policy when dependencies (Mongo) are unavailable.

**Repro (approximate):**

1. Run frontend + backend via `preview_start` in the workbench.
2. Stop the Mongo container.
3. Backend process crashes repeatedly; does not recover when Mongo is started again without manual intervention.

## Workspace header idle/status chrome (2026-08-31)

**Status:** resolved — header chips removed; title is centered; “Waiting on you” is a slim banner above the composer.

**Observed:** Idle dot, turn status chips (Thinking / Running / Waiting on you), and sandbox chips (Starting sandbox / Sandbox error) on the workspace header bar look ugly and clutter the top chrome.

**Verdict:** Remove from header.

**Suggested repositioning:**

1. **Turn status → chat composer** — hide when idle; thinking/running already shown via send/stop button; show "Waiting on you" as a slim banner above composer when ask-user is pending.
2. **Sandbox status → boot screen only** — full-screen `SessionBootScreen` already covers starting/error; no header chips needed.
3. **Optional:** non-idle dot on Chat mode button when user is on Files/Changes/Run.

**Scope:** Web UI polish — `apps/web-ui/src/routes/chat-workbench/session-header.tsx`, composer/chat pane, tests. Not part of terminal work.

---

## Browser preview stacks above modals (2026-08-31)

**Status:** resolved — Electron preview hides while global modals are open.

**Observed:** Once the web-app preview (browser surface) is open, it renders on top of everything — including the **Leave session** confirmation dialog, which appears underneath and is unusable.

**Repro (approximate):**

1. Open a workbench session with a running web app on the preview tab.
2. Click **Leave session** in the header.
3. The confirmation dialog (`ExitSessionDialog` in `session-header.tsx`, `fixed z-50`) is hidden under the preview.

**Likely root cause:** On Electron/desktop, preview uses a native `WebContentsView` positioned via `ElectronPreviewHole` + `useViewHole` → `apps/electron/src/previewHost.ts`. Native child views paint above the React DOM; CSS `z-index` on modals cannot win.

**Suggested fix:**

1. **Electron (primary):** When any global modal/overlay opens (leave session, confirm dialogs, full-screen pickers), call `preview.setVisible(false)` (and `setDevtoolsVisible(false)` if open); restore visibility on close. Consider a shared overlay/modal stack hook.
2. **Web iframe path** (if also reproducible in pure browser): Portal modals to `document.body` with elevated z-index; verify no ancestor `transform`/`filter` traps `fixed` positioning.

**Scope:** Web UI + Electron preview host. Affects any modal, not just Leave session. Not part of terminal work.

---

## Workspace member change does not invalidate deps cache / paths (2026-08-31)

**Observed:** User adds projects to a workspace — `node_modules` is reused from the workspace Docker volume (`forge-ws-deps-*`), paths are generated, analyze/health runs. User then **changes workspace membership** (add/remove/replace projects or repo names). Stale **`node_modules` cache** remains on the volume for removed or renamed repos; new members do not get a clean install path. Route paths / `dependsOn` are partially updated in DB, but **full re-analysis** (health shadows, launch.json catalog, repo inventory, session paths) does not fully reset downstream state.

**Symptoms (approximate):**

1. Add projects A + B to workspace → deps restore/capture works; setup analyze runs.
2. Remove B, add C (or swap projects) → old B cache entries may linger on `forge-ws-deps-{workspaceId}`; restore may target wrong or missing repo paths.
3. Saved launch catalog (`workspace_environments`) and session `launch.json` may still reference removed repo names until manually cleared or re-promoted.
4. New chats may inherit wrong deps or fail silently (`deps restore … ok=false` without forcing reinstall).

**Expected:** When workspace **membership or repoName** changes, Forge should invalidate or prune the workspace deps volume per removed repo, bump health to **recompute** (analyze + DB shadows), recalculate routes/`dependsOn`, and optionally clear or reconcile saved launch until re-detected or re-promoted.

**Relevant code:** `workspace.service.ts` (`addProject` / `removeProject` schedules health but does not call `clearWorkspacePackageCache`), `workspaceDepsCache.ts`, `workspaceEnvironment.ts`, `workspaceHealthJob.ts`, workspace settings “Clear package cache” (manual only today).

**Scope:** Workspace lifecycle — not terminal work.

---

## Unavailable / wrong DB blocks setup with no alternate path (2026-08-31)

**Status:** partial — `ask_user` catalog now tells the agent to MCQ re-provision / paste an alternate URI / skip instead of looping `preview_start`. Full health-engine / `workspace_databases` plumbing is still deferred.

**Observed:** Workspace setup assumes a provisioned DB engine (e.g. Mongo from `setup_project_infra` or workspace parameters). If the configured database is **stopped, wrong, or never provisioned**, the user/agent can be **blocked** with no clear way to connect to a **different** DB instance (local Docker, external URI, alternate engine) without manual env hacking.

**Examples:**

- Mongo container stopped → backend crash loop (see separate Mongo QA item); setup chat cannot proceed.
- Health/analysis references `DATABASE_URL` / engine from workspace DB catalog but engine unreachable.
- User has another Mongo/Postgres available but no guided “use this instead” flow in UI or `ask_user`.

**Needs design:**

1. Detect unreachable vs misconfigured vs missing engine separately in health report.
2. **`ask_user` / workspace settings** path: “DB unavailable — connect to alternate URI”, “re-provision engine”, or “skip DB for now” (where safe).
3. Whether alternate connection updates `workspace_databases`, parameters, and session env atomically.
4. Agent SOP: when engine down, offer reconnect/replace before endless `preview_start` / install retries.

**Scope:** Workspace setup, `setup_project_infra` / `install_project_infra`, parameters, health/analyze — needs product UX pass. Not terminal work.

---

## Fix/Analyze creates duplicate “Workspace setup” chats (2026-08-31)

**Status:** resolved — `ensureSetupChat` coalesces concurrent creates with an in-flight mutex.

**Observed:** Clicking **Fix** or **Analyze** on workspace settings (health CTA or databases tab) creates **two** “Workspace setup” chat rows in the workspace chat list. Session ids are nearly identical (e.g. `workbench-1788173015055` and `workbench-1788173015053`), both titled “Workspace setup”, both “Created today”.

**Repro (approximate):**

1. Open a workspace with member projects.
2. Go to workspace settings → **Overview** (or **Databases** tab Fix/Analyze CTA).
3. Click **Fix** or **Analyze** once.
4. Return to workspace chats list — two “Workspace setup” entries appear.

**Likely cause:** Race or double-invoke in setup drawer open path. `ensureSetupChat` in `workspace-setup-drawer.tsx` does `listWorkspaceChats` then `createWorkspaceChat` if no title match — not atomic. Concurrent opens (double-click, overlapping effects, or two CTAs) can both miss the existing row and create two chats. Backend may lack unique constraint on workspace + setup chat title.

**Expected:** At most **one** “Workspace setup” chat per workspace; second click reuses existing chat/session. Create should be idempotent (server-side upsert or client lock/debounce while drawer opens).

**Suggested fix directions:**

1. Server: `GET or CREATE` setup chat endpoint with unique `(workspaceId, kind=setup)` or title guard.
2. Client: disable Fix/Analyze while `setupDrawerOpen`; mutex in `ensureSetupChat`; handle React Strict Mode double-mount.
3. UI: merge/delete duplicate setup chats or show only the canonical one.

**Relevant code:** `apps/web-ui/src/routes/workspace-setup-drawer.tsx` (`ensureSetupChat`), `workspace-settings-view.tsx` (Fix/Analyze buttons), `apps/web-ui/src/lib/workspaces-api.ts` (`createWorkspaceChat`).

**Scope:** Workspace setup UX — not terminal work.

---

## Revisit running chat: boot loader → empty chat → history pop-in (2026-08-31)

**Status:** resolved — GET sandbox status skips the full boot screen when already ready; EmptyChat waits for `historyLoaded`.

**Observed:** Opening an **existing, already-running** workspace chat later (from chat list) shows a jarring three-step sequence:

1. Full-screen **“Initializing workspace…”** loader (`SessionBootScreen`).
2. Chat pane mounts with **empty state** (“What should we work on?” / starter prompts).
3. **Previous messages appear** after a short delay (history fetch completes).

Feels like a brand-new session even though the sandbox was already up and the chat has history.

**Repro (approximate):**

1. Use a workspace chat that has messages and a running sandbox.
2. Navigate away (chat list, another chat, settings).
3. Re-open the same chat from the workspace chats list.
4. Note loader → empty chat → messages fill in.

**Likely cause (layered):**

1. **Boot screen:** `workspace-chat.tsx` / `chat-workbench.tsx` always call `startSession` on mount and keep `sandboxStatus === "starting"` until the POST returns — even when the container is already running. `booting` hides the whole workbench behind `SessionBootScreen` until that round-trip finishes.
2. **Empty chat flash:** `useChatHistory` starts with `messages = []`; `ChatMessageList` shows `EmptyChat` whenever `messages.length === 0 && !isStreaming` — it does **not** wait for `historyLoaded`. History loads only after the workbench mounts (sequential, not parallel with chat metadata fetch).
3. **No stale-while-revalidate:** No cached messages or skeleton for return visits; UI assumes empty until `fetchSessionMessages` resolves.

**Expected:** Returning to an active chat should feel instant or show a single consistent loading state — e.g. skeleton in the message list, or last-known messages from cache — without “new chat” empty state or full workspace boot copy unless the sandbox is actually starting.

**Suggested fix directions:**

1. **Sandbox:** On revisit, `GET` session/sandbox status first; skip boot screen (or show a lighter inline indicator) when already `ready`. Only full `SessionBootScreen` on cold start or after error.
2. **History:** Gate `EmptyChat` on `historyLoaded === true`; show message-list skeleton or spinner while loading.
3. **Parallel fetch:** Start `fetchSessionMessages` as soon as `sessionId` is known (with chat metadata), not only after sandbox boot completes.
4. **Optional:** Persist last N messages or a “has history” flag per chat in memory/session storage for instant paint on revisit.

**Relevant code:** `apps/web-ui/src/routes/workspace-chat.tsx`, `apps/web-ui/src/routes/chat-workbench.tsx` (`booting`, `startSandbox`), `apps/web-ui/src/routes/chat-workbench/session-boot.tsx`, `apps/web-ui/src/routes/chat-workbench/use-chat-history.ts`, `apps/web-ui/src/routes/chat-workbench/chat-message-list.tsx` (`EmptyChat`).

**Scope:** Chat workbench load UX — not terminal work.

---

## Temporal turn running with no clear progress (streaming suspect) (2026-08-31)

**Status:** resolved — resume attaches the live stream; committed turn steps keep thinking/tools visible across `llm_start`; composer Stop/Thinking remains the turn affordance after header chips were removed.

**Observed:** A Temporal chat turn is running while the user is in the chat workbench, but there is **no clear indicator of what is happening**. Composer shows only a tiny spinner next to the model picker; send control still looks idle/ready. No visible thinking/running copy, no live assistant token stream, no tool-progress surface the user can follow.

**After reload:** Message history / progress that had already happened appears — so the run was advancing server-side, but the live UI was not reflecting it.

**User impact:** “As a user I have no clue what’s going on.” Feels stuck or idle while work continues in Temporal.

**Also suspect:** Token / event **streaming is broken** in this path (or reconnect-to-running-workflow does not attach to the live stream). Progress only becomes visible after a full page reload (history fetch), not via live SSE/WS updates.

**Repro (approximate):**

1. Open a workbench chat and start an agent turn (or leave one running).
2. Stay on the chat workbench — note absence of clear Running/Thinking UI and missing live token/tool updates.
3. Optionally leave and return, or soft-refresh — still weak/no live feedback.
4. Hard reload → previously completed progress appears in history.

**Likely areas:**

1. **Live turn attachment:** On revisit / mid-run, client may not resume Temporal workflow event stream; `status` stays `ready` while a turn is still running.
2. **Composer affordance:** Send arrow instead of Stop when a turn is active; spinner alone is too weak (see also header idle/status QA — status was meant to move to composer).
3. **Streaming path:** Chat SSE/WS token + tool-part updates not applied to `streamingText` / `liveToolParts` (`use-chat-pane-session`, chat turn stream handlers).
4. **Chat activity label:** [`chat-turn-activity.ts`](apps/web-ui/src/routes/chat-workbench/chat-turn-activity.ts) can show “Thinking… / Running…” but may not render or may never leave `ready` if stream never attaches.

**Expected:**

1. While a Temporal turn is running: unmistakable **Running / Thinking / tool name** feedback in chat (composer and/or message list).
2. Send becomes **Stop**; user can cancel.
3. Assistant tokens and tool cards stream live as the workflow progresses.
4. Reopening or refreshing a workbench mid-run **reattaches** to the in-flight turn and continues streaming — not a silent idle composer until reload.

**Relevant code:** `apps/web-ui/src/routes/chat-workbench/use-chat-pane-session*.ts`, `chat-pane-send-text.ts`, `chat-composer.tsx`, `chat-turn-activity.ts`, `chat-message-list.tsx`, Temporal interactive chat workflow / chat API stream endpoints in `packages/orchestrator` + `apps/server`.

**Scope:** Chat workbench + Temporal turn streaming / reconnect — not terminal work. Related to header status repositioning (composer should own clear turn state).

---

## Node deps cache: do not reuse when lockfile signature mismatches (2026-09-01)

**Status:** resolved — restore skips (no `already-*` / `restored-*`) when hashes differ or the cached hash is missing; live `node_modules` is left in place so a running process is not yanked.

**Observed / required:** For Node-based repos, if the **lockfile + package.json signature** does not match the cached hash, Forge must **not** reuse the workspace `node_modules` cache. Soft-restore of a mismatched cache can leave chats with wrong dependency versions and subtle install/runtime failures.

**Current behavior (bug):** [`restoreCachedDeps`](apps/server/src/projects/workspaceDepsCache.ts) computes `lockhash` (`package.json` + primary lock: `pnpm-lock.yaml` → `yarn.lock` → `package-lock.json` → `bun.lockb`) and compares to `${cache}/.forge-lockhash`. On mismatch it only **logs** `hash-mismatch` and still soft-restores (link/copy) so “new chats are not left without node_modules after minor lockfile / package.json drift.”

**Expected:**

1. If `CACHED != CUR` (or cached hash missing while cache exists): **skip restore** — do not `ln`/`cp` cached `node_modules`.
2. Session should fall through to a normal install (`npm`/`pnpm`/`yarn`/`bun`) so modules match the current lockfile.
3. After a successful install, `captureCachedDeps` overwrites cache + writes a new `.forge-lockhash` as today.
4. Exact hash match → reuse cache (link/copy) as today.

**Repro (approximate):**

1. Capture deps for a Node app (workspace volume `forge-ws-deps-*`).
2. Change `package.json` or the primary lockfile in the worktree (or switch branch with different lock).
3. Start a new chat / restore deps.
4. Today: mismatched cache is still linked; should refuse and reinstall instead.

**Suggested fix:** In the restore script, on hash mismatch `exit 0` without linking (and optionally remove a stale live link to cache so install is forced). Keep mismatch logging. Add a unit/integration assertion that restore returns `false` / no `restored-*` when hashes differ.

**Relevant code:** `apps/server/src/projects/workspaceDepsCache.ts` (`LOCKHASH_SCRIPT`, `restoreCachedDeps`, `captureCachedDeps`), callers in session provision / deps restore path.

**Scope:** Workspace deps cache for Node stacks — not terminal work. Related to membership cache invalidation QA item.
