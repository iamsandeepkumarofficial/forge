# Feature Specification: Task I/O Contracts

**Feature Branch**: `002-task-io-contracts`

**Created**: 2026-11-10

**Status**: Accepted (RFC 0013)

**Input**: User description: "Step 2 of the general-purpose workflow: make every task declare mandatory input and output schemas, have the workflow engine move and validate structured data between tasks, and require every executor (agent, tool, human) to produce schema-valid output so the chat transcript is no longer the workflow data bus."

## Clarifications

### Session 2026-11-10

- Q: Persist Zod on the task or serializable schemas? → A: Persist a constrained JSON Schema subset. Zod stays in application code (planner envelope, tool decode).
- Q: Structured agent completion: post-loop generateObject or in-loop? → A: Agent owns completion. Same ReAct loop; each round may emit tools or a schema object. No second LLM call that interprets the transcript.
- Q: Human form validation authority? → A: UI is UX only. Engine validation is the authority.
- Q: Put outputSchema in waitReason.payload? → A: No. UI reads `task.outputSchema` from the plan snapshot via task id.
- Q: Tool output shape — LLM or tool? → A: Tool defines native result. ToolExecutor normalizes; engine validates against task outputSchema. Planner should align those shapes in Step 2.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Downstream tasks receive structured upstream results (Priority: P1)

A developer asks Forge for multi-step research then synthesis. Research tasks complete with structured findings. The synthesize task starts with those findings already assembled as its input — without relying on chat history to rediscover them.

**Why this priority**: This is the core value of Step 2: the plan becomes a typed data pipeline.

**Independent Test**: Run A→B where A emits `{ findings: [...] }` and B’s input schema expects that shape under key `a` (or a mapping). Confirm B’s executor receives the object even when the transcript is cleared or lacks A’s prose.

**Acceptance Scenarios**:

1. **Given** task A completed with schema-valid output, **When** dependent B becomes ready, **Then** B’s resolved input contains A’s materialized output and B starts without reading the transcript for that data.
2. **Given** A, B, and C all completed and D depends on all three, **When** D becomes ready, **Then** D’s input contains keys for A, B, and C (default fan-in) unless mappings say otherwise.
3. **Given** a mapping from `A.output.findings` to `B.input.research`, **When** B becomes ready, **Then** B’s input has `research` set to that array.

---

### User Story 2 - Invalid structured results fail the task (Priority: P1)

An agent, tool, or human produces a result that does not match the declared output schema. The task fails visibly. Dependents stay blocked. The run does not treat free-form prose as success.

**Why this priority**: Mandatory contracts are worthless if invalid output can still mark completed.

**Independent Test**: Force an agent/tool/human to return `{ approved: "banana" }` when the schema requires a boolean. Confirm status is failed (or not completed) and dependents do not start.

**Acceptance Scenarios**:

1. **Given** a task with an object output schema, **When** the executor returns prose or `undefined`, **Then** the task does not reach completed.
2. **Given** a human form for `{ approved: boolean }`, **When** a client submits `{ approved: "banana" }`, **Then** the engine rejects completion even if the UI skipped checks.
3. **Given** a tool that returns a plain string while the task output schema is an object, **When** normalization keeps the string, **Then** engine validation fails the task.

---

### User Story 3 - Plans declare contracts up front (Priority: P1)

When Forge publishes a plan, every task shows (or at least stores) an input and output contract. Malformed or oversized schemas never become a runnable plan.

**Why this priority**: Contracts must be first-class plan artifacts, not invent-on-execute.

**Independent Test**: Planner emits a task with `inventedKeyword` or a 10 MB schema. Confirm planner repair/failure; no plan rows with invalid schemas.

**Acceptance Scenarios**:

1. **Given** a multi-step request that plans, **When** the plan is published, **Then** every task has `inputSchema` and `outputSchema` with `schemaVersion: 1`.
2. **Given** planner output with unknown schema keywords or over budget, **When** validation runs, **Then** that draft is rejected (bounded planner retry), not stored as executable.

---

### User Story 4 - Human review collects structured answers (Priority: P2)

A plan reaches a human review task. The workbench shows a form derived from that task’s output schema. Submitting a valid payload completes the task; invalid payloads do not.

**Why this priority**: Heterogeneous executors must share the same contract model.

**Independent Test**: Waiting human task with `{ approved: boolean, comment: string }`. Confirm form fields appear from the task schema (not waitReason). Valid submit completes; wrong types fail.

**Acceptance Scenarios**:

1. **Given** a waiting human task, **When** the user opens the plan card, **Then** they see fields generated from `task.outputSchema`.
2. **Given** a valid form submission, **When** the answer is signaled, **Then** the same run resumes with schema-valid task output persisted.

---

### User Story 5 - Large results do not inflate durable state (Priority: P2)

A task produces a large structured result. The durable task row stores a reference. The next task still receives the full content when it runs.

**Why this priority**: Prevent Temporal/Postgres/SSE bloat while keeping the data pipeline correct.

**Independent Test**: Force an output larger than the inline threshold. Confirm `output.kind === "artifact"` on the row and the successor’s `context.input` contains the materialized value, not an artifact id.

**Acceptance Scenarios**:

1. **Given** a completed task whose output exceeds the inline size limit, **When** the output is persisted, **Then** the row stores an artifact reference, not the full blob in Temporal history.
2. **Given** a successor of that task, **When** the engine prepares input, **Then** the successor executor receives the loaded contents.

---

### Edge Cases

- Root task with no dependencies: input is planner-provided static input or `{}`, still validated against `inputSchema`.
- Artifact load failure: preparing successor input fails that successor task visibly.
- Parallel fan-in: successor waits until all deps completed; input includes all dep outputs (or mappings).
- Replan: new DAG version must still carry schemas; still-valid completed outputs remain available as wire forms.
- Ask / non-planning ReAct turns: unchanged; no task output schema required.
- Provider cannot combine tools + structured output: agent uses in-loop `complete_task` fallback, not a second interpreter call.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every task on a published plan MUST declare `inputSchema` and `outputSchema` as serializable schema documents with `schemaVersion: 1`.
- **FR-002**: Schema documents MUST conform to the supported subset and schema budget; invalid schemas MUST fail planner validation and MUST NOT execute.
- **FR-003**: Object schemas MUST treat omitted `additionalProperties` as false (closed by default).
- **FR-004**: Before starting a ready task, the engine MUST resolve dependency outputs into that task’s input (default fan-in or declared mappings) and MUST validate the result against `inputSchema`. Invalid input MUST fail the task without calling the executor.
- **FR-005**: Successful task completion MUST persist output conforming to `outputSchema`. Invalid output MUST NOT mark the task completed.
- **FR-006**: Downstream tasks MUST be able to run correctly using task inputs/outputs even when the relevant information is absent from the conversation transcript.
- **FR-007**: Executors MUST receive resolved, validated `input` and MUST NOT resolve dependencies, query the DAG, or load Postgres themselves for I/O wiring.
- **FR-008**: Agent tasks MUST produce structured output as part of the same agent execution loop (tools XOR terminal schema object). The system MUST NOT complete an agent task via a separate post-loop “interpret the transcript” generation.
- **FR-009**: Tool tasks MUST normalize the tool’s native result, then validate against the task output schema. Tool native result shape is defined by the tool implementation, not by the LLM.
- **FR-010**: Human tasks MUST collect a structured payload matching `outputSchema`. Workbench form checks are optional UX; engine validation is authoritative.
- **FR-011**: `waitReason.payload` MUST NOT duplicate `outputSchema`. The UI MUST read schemas from the task on the plan snapshot.
- **FR-012**: Outputs larger than the inline threshold MUST spill to an artifact store with a durable reference on the task; successors MUST receive materialized contents.
- **FR-013**: Field mappings MUST support whole-output and `outputPath` → `targetPath` only (no expression language).
- **FR-014**: Fan-in of multiple completed dependencies MUST populate successor input with each dependency’s materialized output unless mappings override.

### Key Entities

- **TaskSchema**: Constrained JSON Schema document (`schemaVersion`, type, properties, …).
- **InputMapping**: Optional wiring from a dependency output path to an input path.
- **TaskOutput**: Wire form — inline value or artifact reference.
- **ResolvedInput**: Materialized JSON passed to executors and input validation.
- **Artifact**: Large payload stored outside the git worktree under the session metadata tree.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 (AC1)**: 100% of published plan tasks in test runs have both schemas with `schemaVersion: 1` within budget.
- **SC-002 (AC2)**: 100% of invalid executor outputs in test runs fail the task; none reach completed.
- **SC-003 (AC3/AC8)**: In A→B demonstration runs, B receives A’s structured output as input when the transcript does not contain A’s findings, in 100% of those runs.
- **SC-004 (AC4)**: Fan-in of three completed deps into one successor produces an input object containing all three in 100% of test runs.
- **SC-005 (AC5)**: Declared path mappings apply correctly in 100% of mapping test runs.
- **SC-006 (AC6)**: Oversized outputs persist as artifact refs and successors still receive contents in 100% of spill test runs.
- **SC-007 (AC7)**: Stub executors in unit tests can complete successfully with only `context.input` (no DAG access).
- **SC-008**: Human invalid payloads never complete the waiting task in 100% of adversarial client tests.

## Assumptions

- Builds on Step 1 planner/executor (RFC 0011/0012) already shipping.
- Chat-only harness remains; no board or pipeline designer.
- Artifact backend is the local session filesystem; object storage is later.
- Deep schema-to-schema assignability at plan time is out of scope; runtime input validation catches mismatches.
- Tool task `outputSchema` should match native tool results in Step 2; transforming tool results into a different contract is later.
- Project constitution placeholders remain unratified; product gates from RFC 0001 still apply.
