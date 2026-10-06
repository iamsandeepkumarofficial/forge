# Tasks: Planner / Executor Orchestration

**Input**: Design documents from `/specs/001-planner-executor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan constitution gate requires node:test / vitest with behavior (DAG, scheduler, budget, API, plan card).

**Organization**: Setup → Foundational → one phase per user story (P1–P5) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 map to spec user stories
- Each description includes an exact file path

## Path Conventions

Monorepo: `packages/core`, `packages/db`, `packages/orchestrator`, `apps/server`, `apps/web-ui`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workflow module skeleton and exports so later packages can import types

- [x] T001 Create `packages/core/src/workflow/` and export public symbols from `packages/core/src/index.ts`
- [x] T002 [P] Add Zod plan/task draft types (`WorkflowPlanDraft`, `WorkflowTaskDraft`, statuses, executor kinds, budget constants 4/10/20/3/2/30m/500k/$3) in `packages/core/src/workflow/types.ts`
- [x] T003 [P] Add empty workflow-safe DAG helpers module in `packages/core/src/workflow/dag.ts` (no I/O)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, shared ReAct extraction, activity stubs, and worker registration. **Blocks all user stories.**

- [x] T004 Add `workflowPlans` and `workflowTasks` Drizzle tables (fields per `data-model.md`) in `packages/db/src/schema.ts`
- [x] T005 Generate and commit migration `packages/db/migrations/0021_workflow_plans.sql` via `pnpm --filter @forge/db db:generate`
- [x] T006 [P] Add repository methods for plan/task CRUD and `countRunningAgentTasks` in `apps/server/src/catalog/sessionChatRepository.ts` (or new `apps/server/src/catalog/workflowPlanRepository.ts`)
- [x] T007 Extract `runToolRoundLoop` into `packages/orchestrator/src/workflows/reactLoop.ts` and call it from `packages/orchestrator/src/workflows/interactiveChatTurnWorkflow.ts` (Ask path unchanged)
- [x] T008 [P] Add SSE event type constants (`plan_published`, `task_updated`, `plan_status`, `budget_updated`, `followup_queued`, `replan`, `merge_conflict`) in `packages/core/src/workflow/sseEvents.ts`
- [x] T009 Add persist/append-chunk activities `persistPlan`, `persistTask`, `appendPlanChunk` in `packages/orchestrator/src/activities/plan.ts` and export from `packages/orchestrator/src/activities/index.ts`
- [x] T010 Register stub `interactiveAgentWorkflow` and `executeAgentTaskWorkflow` in `packages/orchestrator/src/workflows/index.ts` (export only; bodies filled in US1)
- [x] T011 Add `startInteractiveAgentWorkflow` (workflow id `agent-{sessionId}-{turnId}`) next to existing start helper in `apps/server/src/orchestration/chatTemporalClient.ts`

**Checkpoint**: Schema migrates; Ask-mode ReAct still works; types importable; parent/child workflow names exist

---

## Phase 3: User Story 1 - Explicit plan, then execute task by task (Priority: P1) 🎯 MVP

**Goal**: Agent/Auto publish a structured plan before source edits; existing coding agent executes tasks sequentially; Plan mode plans without mutating; Ask mode never plans; workbench shows the plan card.

**Independent Test**: Agent request shows a plan card then executes tasks. Ask question produces no plan. Plan mode produces a plan with no source mutation.

### Tests for User Story 1

- [x] T012 [P] [US1] Unit tests for cycle/missing-dep/empty/>20-task validation in `packages/core/src/workflow/dag.test.ts`
- [x] T013 [P] [US1] Unit tests that Ask mode still uses `interactiveChatTurnWorkflow` in `apps/server/src/api/chatRouter/handlers.test.ts` (or adjacent test file)
- [x] T014 [P] [US1] Vitest for plan card rendering statuses in `apps/web-ui/src/routes/chat-workbench/plan-card.test.tsx`

### Implementation for User Story 1

- [x] T015 [US1] Implement `validatePlanDraft` (≤20 tasks, unique ids, deps exist, acyclic, required fields) in `packages/core/src/workflow/dag.ts`
- [x] T016 [US1] Implement `createPlan` / `repairPlan` LLM activities with Zod schema in `packages/orchestrator/src/activities/plan.ts`
- [x] T017 [US1] Implement sequential `executeAgentTaskWorkflow` (one ReAct child per task, cap 1) in `packages/orchestrator/src/workflows/executeAgentTaskWorkflow.ts`
- [x] T018 [US1] Implement `interactiveAgentWorkflow` parent: createPlan → persist → execute tasks in list order → finalize in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T019 [US1] Route Agent/Auto/Multitask/Debug/Plan to parent workflow and Ask to `interactiveChatTurnWorkflow` in `apps/server/src/api/chatRouter/handlers.ts`
- [x] T020 [US1] Plan mode: persist plan with status `planned` and do not start mutating children in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T021 [US1] Emit `plan_published` and `task_updated` chunks in `packages/orchestrator/src/activities/plan.ts`
- [x] T022 [US1] Add `GET /api/sessions/:sessionId/plans/current` in `apps/server/src/api/chatRouter.ts` and handler in `apps/server/src/api/chatRouter/handlers.ts`
- [x] T023 [US1] Include plan snapshot on running-turn GET in `apps/server/src/api/chatRouter/handlers.ts`
- [x] T024 [US1] Add `use-plan-stream.ts` to apply SSE plan events in `apps/web-ui/src/routes/chat-workbench/use-plan-stream.ts`
- [x] T025 [US1] Add structured plan card (goal, tasks, statuses) in `apps/web-ui/src/routes/chat-workbench/plan-card.tsx` and mount it in `apps/web-ui/src/routes/chat-workbench/chat-transcript.tsx` (keep `looksLikePlan` only as fallback)

**Checkpoint**: US1 demoable — plan card before edits; sequential execute; Ask unchanged

---

## Phase 4: User Story 2 - Dependencies, overlapping work, retries, worktrees (Priority: P2)

**Goal**: Ready-set DAG with parallel in-session agents (4/run, 10/instance), nested worktrees + completion-order merge, conflict resolver sub-agent (2 attempts) then human wait, idempotent task retries (maxAttempts 3).

**Independent Test**: Two independent inspect/edit tasks can run at once; dependent waits. Same-repo unclean merge aborts, resolver runs ≤2 times with tests in the trace, then waits or continues. Flaky idempotent task retries up to 3.

### Tests for User Story 2

- [x] T026 [P] [US2] Scheduler tests (ready set, dep blocking, caps 4 and 10) in `packages/orchestrator/src/workflows/planScheduler.test.ts`
- [x] T027 [P] [US2] Merge-abort + resolver-attempt bound tests in `packages/orchestrator/src/activities/worktree.test.ts`
- [x] T028 [P] [US2] Idempotent retry vs skip-non-idempotent tests in `packages/core/src/workflow/retryPolicy.test.ts`

### Implementation for User Story 2

- [x] T029 [US2] Implement ready-set scheduler (deps, caps 4/10, pending extras) in `packages/orchestrator/src/workflows/planScheduler.ts`
- [x] T030 [US2] Fan-out independent children with `Promise.all` and slot acquire/release in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T031 [US2] Implement `countRunningAgentTasks` / `acquireTaskSlot` / `releaseTaskSlot` in `packages/orchestrator/src/activities/plan.ts` using `apps/server/src/catalog/workflowPlanRepository.ts`
- [x] T032 [US2] Nested task worktree create on session tree in `apps/server/src/projects/localWorktree.ts`
- [x] T033 [US2] `ensureTaskWorktree` activity in `packages/orchestrator/src/activities/worktree.ts` and pass `worktreePath` into `executeAgentTaskWorkflow`
- [x] T034 [US2] Merge completed worktrees in completion order; on conflict abort (no half-merged tree) and persist conflict artifacts in `packages/orchestrator/src/activities/worktree.ts`
- [x] T035 [US2] Spawn conflict-resolution child (same coding-agent executor, diffs/files/plan context, relevant tests, max 2 attempts) in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T036 [US2] Emit `merge_conflict` SSE (`resolving` | `waiting_human` | `merged`) from `packages/orchestrator/src/activities/plan.ts`
- [x] T037 [US2] After 2 failed resolver attempts, set waitReason `merge_conflict` and keep artifacts in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts` (human resume/replan wired in US4)
- [x] T038 [US2] If adding a resolver task would exceed 20 tasks, skip auto-resolver and wait on the user in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T039 [US2] Task retry policy: idempotent test/compile/runtime up to 3 attempts; non-idempotent skip FR-010 in `packages/core/src/workflow/retryPolicy.ts` and `packages/orchestrator/src/workflows/executeAgentTaskWorkflow.ts`

**Checkpoint**: Parallel independents + worktree merge/conflict path + retries work without US3/US4

---

## Phase 5: User Story 3 - Replanning after failure (Priority: P3)

**Goal**: Strategy-miss after task attempts produces a new DAG version (max 2 replans); keep valid completed work; stop on 30m working / 500k tokens / $3.00.

**Independent Test**: Missing-dependency style failure → version 2 with new tasks and kept completions. Two replans exhausted → failed with last plan visible. Budget stopReason visible even if attempts remain.

### Tests for User Story 3

- [x] T040 [P] [US3] Replan copy-forward / invalidate tests in `packages/orchestrator/src/workflows/replan.test.ts`
- [x] T041 [P] [US3] Working-time pause vs tick and token/cost cap tests in `packages/core/src/workflow/budget.test.ts`

### Implementation for User Story 3

- [x] T042 [US3] Implement `replan` activity (new version, preserve completed unless invalidated) in `packages/orchestrator/src/activities/plan.ts`
- [x] T043 [US3] Parent: on exhausted attempts or strategy miss, replan up to 2 times; emit `replan` then `plan_published` in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T044 [US3] After 2 replans with goal unmet, fail/wait with last version visible in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T045 [P] [US3] Token usage recording from LLM activities in `packages/orchestrator/src/activities/plan.ts` (`recordLlmUsage`)
- [x] T046 [P] [US3] Provider price table and USD estimate in `packages/core/src/workflow/priceTable.ts`
- [x] T047 [US3] Accumulate `workingMs` only while a child is running; stop on 30m / 500k / $3; persist `budgetStopReason`; emit `budget_updated` in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T048 [US3] Show version, replan reason, and budget on the plan card in `apps/web-ui/src/routes/chat-workbench/plan-card.tsx`

**Checkpoint**: Replan + budget caps visible and enforced

---

## Phase 6: User Story 4 - Approval pauses the same run (Priority: P4)

**Goal**: Human wait does not end the Temporal workflow; siblings may continue; idle wait pauses the time cap; normal send queues (single slot); force send cancels and starts a new run.

**Independent Test**: ask_user wait → answer resumes same plan. Idle wait does not burn 30m. Default send queues (no 409). Send now cancels and starts new.

### Tests for User Story 4

- [x] T049 [P] [US4] Handler tests: queue replace vs `forceSend` vs 202 start in `apps/server/src/api/chatRouter/handlers.test.ts`
- [x] T050 [P] [US4] Vitest for queue banner and Send now in `apps/web-ui/src/routes/chat-workbench/plan-card.test.tsx`

### Implementation for User Story 4

- [x] T051 [US4] Parent signals `queueFollowUp`, `forceSend`, `userAnswer`, `cancelRun` and child signal `resumeTask` in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts` and `packages/orchestrator/src/workflows/executeAgentTaskWorkflow.ts`
- [x] T052 [US4] On `ask_user` / mode-switch confirmation, set task `waiting` and wait on `resumeTask` without completing the parent in `packages/orchestrator/src/workflows/executeAgentTaskWorkflow.ts`
- [x] T053 [US4] Plan status `waiting` only when no children in flight; otherwise `running`; additional tasks do not start while a wait is open in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T054 [US4] Pause `maxExecutionTime` only when no work is in flight in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T055 [US4] `POST /api/sessions/:sessionId/turns/:turnId/answer` signals `userAnswer` in `apps/server/src/api/chatRouter/handlers.ts`
- [x] T056 [US4] Change `POST .../chat`: if run active and `forceSend` false → 202 queued (replace slot); if `forceSend` true → cancel parent+children, discard queue, start new run — replace 409 in `apps/server/src/api/chatRouter/handlers.ts`
- [x] T057 [US4] After parent reaches terminal status, start queued follow-up as a new run in `apps/server/src/api/chatRouter/handlers.ts` (or a small completer in `apps/server/src/orchestration/chatTemporalClient.ts`)
- [x] T058 [US4] Bind Ask-user / mode-switch widgets to `taskId` in `apps/web-ui/src/routes/chat-workbench/use-pending-ask-user.ts` (and mode-switch hook)
- [x] T059 [US4] Queue banner + Send now (`forceSend: true`) on the plan card in `apps/web-ui/src/routes/chat-workbench/plan-card.tsx` and composer send path `apps/web-ui/src/routes/chat-workbench/chat-pane-send-text.ts`
- [x] T060 [US4] Wire merge-conflict human wait (from T037) to `userAnswer` / replan choice in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts` and the plan card in `apps/web-ui/src/routes/chat-workbench/plan-card.tsx`

**Checkpoint**: Same-run HITL, queue, force send, idle clock pause all work

---

## Phase 7: User Story 5 - Task kinds without a zoo of agents (Priority: P5)

**Goal**: `agent` | `tool` | `human` executor kinds. Direct-action skips extra planning but never skips install/deploy/destructive/mode-switch approvals. Parallel agents remain the same coding-agent kind.

**Independent Test**: Mix of agent, tool, and human tasks on one plan routes correctly; deploy-like tool still waits; several agent tasks still run without specialist personas.

### Tests for User Story 5

- [x] T061 [P] [US5] Executor routing tests (agent/tool/human + approval never skipped) in `packages/orchestrator/src/workflows/executorKinds.test.ts`

### Implementation for User Story 5

- [x] T062 [US5] `executeDirectTool` activity in `packages/orchestrator/src/activities/plan.ts`
- [x] T063 [US5] Parent routes `executor=tool` to direct tool (no extra planner step) but forces wait for install/deploy/destructive/mode-switch in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T064 [US5] Parent routes `executor=human` to waiting task (FR-013) in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T065 [US5] Show executor kind on the plan card in `apps/web-ui/src/routes/chat-workbench/plan-card.tsx`

**Checkpoint**: All three executor kinds work; no named specialist roster required

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Gates, validation guide, leftover Ask-path safety

- [x] T066 [P] Document planner/executor behavior in `docs/rfcs/0011-planner-executor.md` (short RFC pointing at specs)
- [x] T067 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` and fix regressions
- [x] T068 Walk `specs/001-planner-executor/quickstart.md` scenarios A–F on desktop and record gaps
- [x] T069 Cancel path: parent `finally` cancels children listed on the plan in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts` and `apps/server/src/orchestration/chatTemporalClient.ts`

---

## Phase 9: LLM Planning Gate

**Purpose**: Bypass Planner→DAG for conversational / single-step turns (FR-032)

**Goal**: Agent/Auto/Multitask/Debug run a cheap LLM gate; `needsPlanning: false` → ReAct only (no Plan UI); Plan mode always plans; gate failure under-plans

**Independent Test**: `"Hi"` in Agent → greeting, no Plan card. `"Add auth then tests"` → plan UI.

### Implementation for Planning Gate

- [x] T070 [P] Replace regex gate with `PlanningGateResult` / `PLANNING_GATE_SYSTEM` / `parsePlanningGateResult` / `planningGateShortcut` in `packages/core/src/workflow/planningGate.ts` and export from `packages/core/src/workflow/index.ts`
- [x] T071 [P] Unit tests for gate parse + mode shortcuts in `packages/core/src/workflow/planningGate.test.ts`
- [x] T072 Add `runPlanningGate` activity (cheap LLM, fail → direct) in `packages/orchestrator/src/activities/plan.ts` and export from `packages/orchestrator/src/activities/index.ts`
- [x] T073 Branch `interactiveAgentWorkflow`: gate false → `runToolRoundLoop` finalize without `createPlan`/`persistPlan`; gate true → existing Planner→DAG path in `packages/orchestrator/src/workflows/interactiveAgentWorkflow.ts`
- [x] T074 [P] Branch / shortcut tests in `packages/orchestrator/src/workflows/planningGateBranch.test.ts` (and activity shortcut coverage)
- [x] T075 Update `specs/001-planner-executor/spec.md` (US1 scenario 5, FR-007, FR-032, clarifications) and `docs/rfcs/0011-planner-executor.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all stories
- **US1 (Phase 3)**: After Foundational — MVP
- **US2 (Phase 4)**: After US1 (needs parent/child + persist)
- **US3 (Phase 5)**: After US1; budget/replan hook into the same parent (best after US2 ready-set)
- **US4 (Phase 6)**: After US1; merge-conflict human wait completes US2 T037
- **US5 (Phase 7)**: After US1; human kind shares US4 signals
- **Polish (Phase 8)**: After desired stories

### User Story Dependencies

- **US1**: After Foundational only — MVP
- **US2**: After US1 (extends parent with scheduler/worktrees)
- **US3**: After US1 (replan/budget on parent)
- **US4**: After US1 (signals on parent/child); T060 after US2 T037
- **US5**: After US1; approvals after US4

### Parallel Opportunities

- T002/T003 after T001
- T006/T008 after T004
- US1 tests T012–T014 in parallel
- US2 tests T026–T028 in parallel
- T045/T046 in parallel during US3
- T049/T050 in parallel during US4

---

## Parallel Example: User Story 1

```bash
# After T011, launch US1 tests together:
Task: "Unit tests for DAG validation in packages/core/src/workflow/dag.test.ts"
Task: "Ask-mode routing tests in apps/server/src/api/chatRouter/handlers.test.ts"
Task: "Plan card Vitest in apps/web-ui/src/routes/chat-workbench/plan-card.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1
4. **STOP and VALIDATE** quickstart Scenario A + B
5. Demo plan card + sequential execute

### Incremental Delivery

1. Setup + Foundational
2. US1 → MVP demo
3. US2 → parallel + worktrees + conflict resolver
4. US3 → replan + budgets
5. US4 → durable HITL + queue/force send
6. US5 → tool/human kinds
7. Polish + quickstart A–F

### Parallel Team Strategy

After Foundational: one person on US1 parent/child, another on API+UI plan card (T022–T025), then join for US2 worktrees.

---

## Notes

- [P] = different files, no incomplete-task dependency
- Sequential children in US1 (cap 1) by design; US2 raises cap to 4
- Do not invent named specialist agents; conflict resolver is the existing coding-agent executor
- Commit after each task or logical group
- Verify tests fail before implementing where TDD tasks are listed
