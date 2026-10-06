# Research: Planner / Executor Orchestration

## 1. Durable coordinator vs inner ReAct loop

**Decision:** A new Temporal **parent** workflow (`interactiveAgentWorkflow`) owns the plan DAG, budgets, waits, queue/force-send, and fan-out. Each agent task runs as a **child** workflow that reuses today’s ReAct loop (`runToolRoundLoop` extracted from `interactiveChatTurnWorkflow`). Temporal does not step every LLM token.

**Rationale:** The spec needs one durable run that can wait, replan, and resume. Forge already persists a chat turn as a Temporal workflow. Child workflows give independent retry, cancel, and heartbeats per in-session agent without exploding parent history. Ask mode keeps the existing single-turn workflow.

**Alternatives considered:**

- One giant ReAct loop that “remembers” the plan in prompts — fails FR-005 (executor must pick ready tasks from the graph).
- Temporal activity per tool call — too chatty; already rejected by the original architecture notes.
- Separate Temporal worker / new package — extra ops; keep `@forge/orchestrator`.

## 2. Parallel in-session agents

**Decision:** Parent starts up to **4** child workflows for ready independent agent tasks (`Promise.all` on the ready set). A Postgres count of `workflow_tasks.status = 'running'` enforces the **10** instance cap before each start. Extra ready tasks stay `pending`. Same chat session; no extra chats.

**Rationale:** Spec caps are 4 per run / 10 per instance. Child workflows map 1:1 to in-session agents. Instance cap is cross-run, so it cannot live only in one workflow — count running rows.

**Alternatives considered:**

- Temporal worker-level `maxConcurrentActivityTaskExecutions` — does not distinguish agent tasks from LLM/tool activities.
- Always sequential ready-set — violates SC-004.
- One child per plan with internal threads — harder cancel/retry isolation.

## 3. Same-repo isolation (worktrees)

**Decision:** Parallel **mutating** tasks on the same repo get a nested git worktree from the session tree (RFC 0005 `localWorktree.ts`). Completed worktrees merge into the session branch **in completion order**. If a merge is not clean: abort so the session tree is not half-merged; record conflict artifacts; spawn a **bounded conflict-resolution sub-agent** using the existing coding-agent executor (not a named specialist) with diffs, files, and plan context; up to **2** attempts including relevant tests; trace every attempt. If still invalid: wait on the user (resolve or replan) with conflict state preserved. Dependents stay pending until a valid merge exists. Explore-only tasks may share the session tree. Different repos already have separate session mounts.

**Rationale:** User clarification: same session, isolate with worktrees, merge on complete. RFC 0005 already creates per-session worktrees under `~/.forge/sessions/{projectId}/{sessionId}/`. Nested `git worktree add` from that tree is the smallest isolation that still merges.

**Alternatives considered:**

- Shared session tree for all mutators — races (rejected by spec).
- Full extra clones per task — disk-heavy vs worktrees.
- Auto-resolve ours/theirs or leave a conflicted index — silent or broken trees.
- Named “merge specialist” agent — out of spec; use the existing coding-agent executor.

## 4. Human wait, queue, and force send

**Decision:** Parent workflow stays alive. Signals:

- `userAnswer` — resume a waiting task (replace today’s “end turn, start new workflow on reply”).
- `queueFollowUp` — single-slot queued request (normal send while run active). Today’s `POST .../chat` **409** becomes **202 queued** unless `forceSend: true`.
- `forceSend` — cancel parent + children, discard queue, start a new run.
- `cancelRun` — existing cancel path.

Time budget **pauses** only when no child is running (pure wait). Tokens/cost accrue while any child works, including siblings that continue during another task’s wait.

**Rationale:** Spec P4 and clarifications. Ending the workflow on `ask_user` is the limitation called out in the original design.

**Alternatives considered:**

- Keep 409 + user retries — violates queue-by-default.
- Pause all children on any wait — user chose continue-independents (option B).

## 5. Plan persistence

**Decision:** New tables `workflow_plans` and `workflow_tasks` (Drizzle + migration `0021`). One plan per chat turn / run. Tasks are rows (not only JSON) so instance concurrency can `COUNT(*)`. Plan JSON snapshot also stored on the plan row for SSE `plan_published`. Chunks reuse `chat_turn_chunks` with new `eventType`s.

**Rationale:** Turns already exist (`chat_turns`). A run _is_ a turn with a plan. Queryable task rows beat a JSON blob for caps, waits, and UI reload (FR-009).

**Alternatives considered:**

- JSONB only on `chat_turns` — hard to count running agents instance-wide.
- New product table disconnected from turns — duplicates session/turn identity.

## 6. Planner output and validation

**Decision:** `createPlan` uses Vercel AI SDK `generateObject` with a Zod `planDraftSchema` (goal, tasks ≤20, executor kinds). Then `validatePlanDraft` enforces unique ids, existing deps, and acyclic DAG. Model/provider or schema failures get a bounded retry (max 2 attempts) and then fail as a **planner invocation failure** — not a workflow replan. Workflow replan (`repairPlan` during execution) is reserved for when an already-valid plan becomes invalid at runtime. Agent/Auto/Multitask/Debug plan-then-execute (after the planning gate); Plan mode publishes and waits; Ask mode never calls this.

**Rationale:** Spec constraints are testable in unit tests without Temporal.

**Alternatives considered:**

- Free-form markdown plans (`looksLikePlan`) — not durable graph state.
- User-authored YAML pipelines — out of spec.

## 7. Retry, replan, budgets

**Decision:**

- Task attempts: child workflow retry for test/compile/runtime on **idempotent** tasks, `maxAttempts: 3`. Non-idempotent side-effectful tasks skip FR-010 and fail/replan.
- Replan: parent activity `replan` produces DAG version n+1, keeps completed tasks unless invalidated, `maxReplans: 2`.
- Working time: parent accumulates `workflow.now()` while any child is running; stop at 30 minutes.
- Tokens: sum usage from LLM activities (AI SDK `usage`); stop at 500_000.
- Cost: estimate USD from a small provider price table in core (input/output per 1M tokens); unknown model → treat as OpenAI-compatible default rate so the $3 cap is still enforced. Stop when any cap hits.

**Rationale:** Spec numbers. Cost is an estimate; perfect billing is planning-deferred but a default rate keeps FR-027 testable.

**Alternatives considered:**

- Wall-clock including waits — user rejected.
- No cost until billing exists — would leave maxCost unenforced.

## 8. Workbench UX

**Decision:** Structured **plan card in the chat transcript** (same visit, no new route) plus live SSE. Composer: while a run is active, primary send **queues** (banner on the plan card); explicit **Send now** force-sends. Waiting tasks reuse Ask-user / mode-switch widgets bound to `taskId`. Heuristic `looksLikePlan` remains only as fallback when no plan artifact exists.

**Rationale:** SC-001 / SC-002. Layout (pane vs inline) was deferred; transcript card is the minimum that meets “no extra navigation.”

**Alternatives considered:**

- Separate /plan page — extra navigation, fails SC-001.
- Markdown-only — not a first-class artifact.

## 9. Direct-action and safety

**Decision:** `executor: "tool"` runs a named tool activity without an extra planner step, but still routes install/deploy/destructive/mode-switch through waiting tasks (FR-015). `executor: "human"` is always a wait. `executor: "agent"` is the child ReAct workflow.

**Rationale:** User chose approvals over skip-safety.

## 10. What stays unchanged

**Decision:** Sandbox provision, tool catalog, preview, Electron desktop, Ask-mode ReAct, follow-up cards (`create_subtask`) for out-of-scope later work.

**Rationale:** Spec: build on the existing agent; no new product surface.
