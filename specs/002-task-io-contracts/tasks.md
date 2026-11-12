# Tasks: Task I/O Contracts

**Input**: Design artifacts from `/specs/002-task-io-contracts/`  
**Prerequisites**: RFC 0013 Accepted; Phase 0 docs complete

## Phase 1 — Foundational (core)

- [x] T001 Add schema constants, `TaskSchema`, `InputMapping`, `TaskOutput`, context/result type deltas in `packages/core/src/workflow/types.ts`
- [x] T002 Implement `packages/core/src/workflow/schemas/` (types, validate-schema, validate-input, validate-output, resolve-input, check-compatibility)
- [x] T003 Wire `validateTaskSchema` + mapping checks into `validatePlanDraft` in `dag.ts`
- [x] T004 Unit tests for budget, schemaVersion, additionalProperties default, inventedKeyword, fan-in, path mapping, materialization helpers

## Phase 2 — Persistence

- [x] T005 Add migration `0022_task_io_contracts.sql` (`input_schema`, `output_schema`, `input_mappings`)
- [x] T006 Update Drizzle `schemaWorkflow.ts` and repository insert/patch paths
- [x] T007 Update internal workflow handlers + orchestrator persist activities to round-trip new fields
- [x] T008 Update `draftToTasks` / `toSnapshot` to carry schemas (omit bulky I/O from SSE snapshot if needed)

## Phase 3 — Engine + artifacts

- [x] T009 Activity `spillTaskOutput` / `loadTaskArtifact` writing under `~/.forge/sessions/_artifacts/...`
- [x] T010 Activity `prepareTaskInput` (load artifacts, apply mappings, return materialized input)
- [x] T011 Launch path: prepare → validate input → execute with `context.input`; validate output → spill → persist
- [x] T012 Move metrics off `output.finalText` onto `ExecutionResult.metrics`
- [x] T013 Stub-executor tests: DAG-ignorant executor; A→B without transcript (AC8)

## Phase 4 — Planner

- [x] T014 Extend `planDraftSchema` nested Zod with strict subset + `schemaVersion: 1`
- [x] T015 Update planner system prompt for contracts / closed objects / fan-in keys
- [x] T016 Ensure planner failures on bad schemas use existing bounded retry

## Phase 5 — Agent structured completion

- [x] T017 Inject description + input + outputSchema before ReAct in agent child
- [x] T018 Pass `output: Output.object({ schema: jsonSchema(...) })` into planned-agent `runLlmStep` / `streamText`
- [x] T019 Complete on schema object; fail/retry when neither tools nor object; no post-loop generateObject
- [ ] T020 Add `complete_task` tool fallback for providers that cannot combine tools + structured output
- [x] T021 Stop persisting `{ finalText }` as task output; return wire `TaskOutput` + metrics

## Phase 6 — Tool + Human

- [x] T022 `normalizeRawToolResult` in ToolExecutor; engine validates outputSchema
- [x] T023 Extend answer API / signal to `{ taskId, payload }`; HumanExecutor resume passes payload through
- [x] T024 Engine validateTaskOutput on human complete; invalid → failed
- [x] T025 Plan card generated form from `task.outputSchema` (string/number/boolean/enum; nested as JSON textarea)
- [x] T026 UI client: answerChatTurn sends payload; do not treat client validation as authority

## Phase 7 — Polish

- [x] T027 Fan-in + field-mapping integration tests
- [x] T028 Artifact spill/load integration test
- [x] T029 Adversarial human payload test (`approved: "banana"`)
- [ ] T030 Quickstart walkthrough against showcase graph
- [x] T031 Update RFC 0012 “out of scope” note / cross-link 0013 if needed

## Dependencies

```text
T001–T004 → T005–T008 → T009–T013 → T014–T016
                              ↓
                    T017–T021  T022–T026
                              ↓
                         T027–T031
```
