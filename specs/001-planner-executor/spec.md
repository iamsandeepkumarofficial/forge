# Feature Specification: Planner / Executor Orchestration

**Feature Branch**: `001-planner-executor`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Add a planner/executor layer above Forge's current one-action-at-a-time agent loop. The planner produces an explicit, persistent task graph; an executor runs ready tasks (initially via the existing agent), honoring dependencies, parallel work, retries, replanning on failure, and in-run human approval. Multi-agent specialization is later, not first."

## Clarifications

### Session 2026-09-22

- Q: Independent-task overlap → A: In-session parallel agents for independent explore or change work (same chat session; different repos or modules as the plan defines); dependents still wait. Named specialist personas remain later.
- Q: New message while a plan is running → A: Queue the message until the current run finishes, then start a new run for it. Force send cancels the current run (including in-session agents) and starts a new run with that message.
- Q: How many in-session agents at once? → A: Max 4 concurrent in-session agents per run; max 10 concurrent in-session agents per Forge instance. Extra ready tasks wait for a slot. Future: resource-aware adaptive scheduling.
- Q: Retry vs replan, and budgets → A: Retry is task-level (test/compile/runtime failure) up to maxAttempts 3. Repeated failure that shows the strategy is wrong triggers a replan (new DAG version) up to maxReplans 2. Runs also have an overall budget (maxExecutionTime, maxLLMTokens, maxCost). Side-effectful tasks retry only when idempotent.
- Q: Default overall run budget → A: maxExecutionTime 30 minutes; maxLLMTokens 500000; maxCost 3.00 (USD). The run stops when any cap is exceeded.
- Q: Does the time budget pause while waiting on the user? → A: Pause wall-clock maxExecutionTime while the run is waiting on the user. Tokens and cost accrue only during work.
- Q: If one task waits on the user, do other agents keep going? → A: Independent already-running agents continue; dependents of the waiting task stay pending; do not start additional tasks while a human wait is open. The time cap pauses only when no work is in flight.
- Q: Can a direct-action task skip approval? → A: No. Direct-action still requires existing approvals (install, deploy, destructive, mode switch). Parallel agents stay in the same session; they may isolate on worktrees and merge after those tasks complete.
- Q: Max tasks on one plan version? → A: 20 tasks per plan version (original or replan).
- Q: Worktree merge conflict semantics → A: On unclean merge, parent records the conflict and spawns a bounded conflict-resolution sub-agent using the existing coding-agent executor (not a named specialist). Resolver gets diffs, affected files, and plan/task context; it reconciles then runs relevant tests. Max 2 resolver attempts; all attempts, changes, tests, and outcomes are in the run trace. If still invalid, wait on the user for human resolution or replan; preserve conflict state and trace. Session tree is not left half-merged.

### Session 2026-09-22 (planning gate)

- Q: Must every Agent/Auto turn produce a plan? → A: No. An LLM planning gate classifies whether the request needs Planner→DAG→Executor. Conversational or single-step ReAct-completable requests skip planning (no plan artifact / Plan UI). Multi-step, dependent, parallel, durable-wait, human-approval, or retry/replan-benefit requests plan. Plan mode always plans. Ask mode never plans. Gate failure biases to direct ReAct (under-plan). The gate only returns `{ needsPlanning, reason }` — it does not create tasks or execute tools.

## User Scenarios & Testing _(mandatory)_

Forge today decides the next tool or reply one step at a time. The user mostly infers the "plan" from chat history. This feature makes the plan a first-class, visible, durable artifact: the system writes the work breakdown, then executes it, and can revise it when reality disagrees.

### User Story 1 - Explicit plan, then execute task by task (Priority: P1)

A developer asks Forge to do a multi-step coding job (for example, "Add authentication to this application"). Before mutating the repo, Forge publishes a structured plan of tasks (inspect architecture, identify the auth boundary, implement middleware, add tests, verify). Ready tasks then run: dependent work waits; independent work may run as parallel in-session agents. The developer can see the goal, the task list, and which tasks are current—without reconstructing intent from a long transcript of improvised tool calls.

**Why this priority**: This is the smallest change that delivers the core value: the plan becomes explicit state instead of implicit conversation memory. It builds on the agent Forge already has.

**Independent Test**: Send a multi-step implementation request in Agent or Auto. Confirm a structured plan appears with ordered tasks, then confirm the agent executes those tasks (not an unbounded improvisation with no plan artifact). A trivial Ask-mode question must not produce an execution plan. A trivial Agent-mode greeting (for example "Hi") must use ReAct only and must not show a Plan card.

**Acceptance Scenarios**:

1. **Given** a connected workspace and Agent or Auto mode, **When** the user asks for a multi-step coding change, **Then** Forge publishes a structured plan (goal + ordered tasks) before it starts mutating source, and the user can read that plan in the workbench.
2. **Given** a published plan, **When** execution proceeds, **Then** each task is worked by a coding agent in the same session, and the workbench shows that task as pending, running, completed, or failed.
3. **Given** Plan mode, **When** the user asks for the same multi-step change, **Then** Forge publishes the same kind of structured plan and does not edit source, run shell, or otherwise mutate the project until the user continues in an implementing mode.
4. **Given** Ask mode, **When** the user asks a question, **Then** Forge answers without creating an execution plan.
5. **Given** Agent or Auto mode and a conversational or single-step request the ReAct turn can complete (for example "Hi" or a short factual question), **When** the planning gate returns `needsPlanning: false`, **Then** Forge answers via the existing ReAct chat path and does not publish a plan artifact or Plan UI.
6. **Given** a running plan, **When** the user sends a new request normally, **Then** that message is queued, the current run continues, and a new run for the queued message starts only after the current run finishes.
7. **Given** a running plan, **When** the user force-sends a new request, **Then** the current run and its in-session agents cancel, pending tasks do not start, and a new run begins with the force-sent message.

---

### User Story 2 - Dependencies, overlapping work, and retries (Priority: P2)

The developer’s plan has some tasks that do not depend on each other (inspect frontend and backend, or change different repos / modules) and later tasks that do (design a solution only after those inspections finish). The planner decides what is independent. The main run may invoke parallel in-session agents for those independent tasks—exploration or implementation. Dependent tasks stay pending until their prerequisites complete. Transient failures on a task may be retried without throwing away the rest of the plan.

**Why this priority**: Once a plan exists, the next leap is executing the graph. Users get overlapping independent work in one chat (for example localizing a site by exploring or editing frontend and backend at the same time) without extra chats or a zoo of named specialist agents.

**Independent Test**: Use a plan whose first tasks have no dependencies (for example explore frontend and explore backend) and whose later task depends on all of them. Confirm more than one independent task can be running at once via in-session agents, and the dependent task does not start until those prerequisites complete. Confirm a flaky task is retried up to a documented limit before it is marked failed.

**Acceptance Scenarios**:

1. **Given** independent tasks such as explore-frontend and explore-backend (or independent edits in different repos or modules), **When** the plan starts, **Then** the run may invoke parallel in-session agents so more than one of those tasks can be running at once (up to 4 in that run, and up to 10 on the Forge instance), they stay in the same chat session, same-repo mutating work may isolate on worktrees and merge when those tasks complete, and the workbench shows each agent's task status.
2. **Given** more than 4 independent ready tasks in one run, **When** four in-session agents are already running, **Then** the extra tasks stay pending until a slot frees; they do not exceed the per-run cap.
3. **Given** task D depends on A, B, and C, **When** any of A, B, or C is still pending, running, or failed, **Then** D remains pending and is not started.
4. **Given** a completed prerequisite, **When** a dependent task becomes fully unblocked, **Then** that task becomes eligible without the user restating the plan.
5. **Given** a task fails with a test, compile, or runtime error and the task is safe to repeat, **When** fewer than 3 attempts have been used, **Then** Forge retries that same task and preserves the rest of the plan; **When** 3 attempts are exhausted without a strategy change, **Then** the task is failed and dependents stay blocked unless a replan starts.
6. **Given** a side-effectful task that is not idempotent, **When** it fails, **Then** Forge does not blindly retry it with the same maxAttempts rule; it fails the task or replans instead of repeating an unsafe action.
7. **Given** a plan that includes a conditional follow-up (for example "if tests fail, collect logs"), **When** the condition is met, **Then** the follow-up becomes part of the visible plan rather than disappearing into untracked improvisation.
8. **Given** two parallel same-repo worktrees that both change the same file, **When** the second merge into the session tree is not clean, **Then** the parent records the conflict, does not leave a half-merged tree, and starts a conflict-resolution in-session agent (same coding-agent kind) with diffs, files, and plan context.
9. **Given** that resolver, **When** it produces a valid merge and relevant tests pass within 2 attempts, **Then** dependents may start and the trace shows attempts, changes, tests, and outcome.
10. **Given** that resolver fails both attempts, **When** no valid merge exists, **Then** the run waits on the user with the conflict state and trace preserved so they can resolve it or replan.

---

### User Story 3 - Replanning after failure (Priority: P3)

The plan is: modify auth middleware, update tests, run tests. Running tests keeps failing in a way that shows the original approach is wrong (for example a missing dependency). Forge does not only retry the same task: after task-level attempts are spent (or the failure is clearly a strategy miss), it replans—a new DAG version, up to 2 replans—and continues in the same run. The developer can see both the original plan and what changed.

**Why this priority**: Retry is task-level recovery. Replanning is strategy recovery. Together they are what make this agent orchestration rather than a blind workflow retry loop.

**Independent Test**: Force a planned "run tests" task to fail for a missing dependency through its task attempts. Confirm a new plan version (new DAG) appears with at least one new or changed task addressing the failure, prior completed tasks remain completed, and execution continues without the user pasting the error back in.

**Acceptance Scenarios**:

1. **Given** a running plan whose task has exhausted its 3 attempts, or whose repeated failures show the original strategy is wrong, **When** fewer than 2 replans have been used, **Then** Forge produces a new plan version (new DAG) that includes new or modified tasks aimed at the failure.
2. **Given** a replan, **When** the user views the run, **Then** they can tell which plan version they are on, which tasks were original, which were added or changed, and which already completed work was kept.
3. **Given** completed tasks whose outputs are still valid, **When** replanning happens, **Then** those tasks are not redone unless the new DAG explicitly invalidates them.
4. **Given** 2 replans have already been used, **When** another strategy failure occurs, **Then** the run stops in a failed or waiting state with the last plan version and failure visible, rather than looping forever.
5. **Given** a successful replan path, **When** the new tasks complete, **Then** the original goal can still complete in the same run.
6. **Given** a run that exceeds 30 minutes of working time, 500000 LLM tokens, or 3.00 USD, **When** that cap is hit, **Then** the run stops even if task attempts and replans remain, with the last plan and the budget reason visible. Time spent in a fully idle wait on the user does not count toward the 30 minutes.

---

### User Story 4 - Approval pauses the same run (Priority: P4)

A task needs the developer (deploy, install a host dependency, switch mode, confirm a destructive action). The run waits on that task. The developer answers in the workbench. The same plan resumes: completed tasks stay completed, the waiting task continues, later tasks have not been lost. Restarting Forge or leaving and returning does not wipe the plan.

**Why this priority**: Today, asking the user ends the current turn and a new turn starts on the reply. That drops the sense of one durable run. Waiting in-place is the user-visible proof that the plan is real state.

**Independent Test**: Start a planned run that hits an approval task. Confirm the plan shows that task as waiting. Submit the answer. Confirm the same plan continues (same goal, same task identities, prior completions preserved) rather than starting from a blank turn. Interrupt the app while waiting; reopen and still see the waiting plan.

**Acceptance Scenarios**:

1. **Given** a task that requires human approval or input, **When** the executor reaches it, **Then** that task is waiting, tasks that depend on it do not start, and already-running independent in-session agents continue.
2. **Given** a waiting task plus still-running independent agents, **When** the user has not yet answered, **Then** the plan stays running (not fully idle), additional tasks do not start, and the 30-minute clock keeps ticking.
3. **Given** a waiting task and no in-session agents still working, **When** the user has not yet answered, **Then** the plan status is waiting and the 30-minute clock is paused.
4. **Given** a waiting task, **When** the user answers or skips, **Then** the same run resumes from that task without the user re-sending the original request; completed work and still-running independent agents are preserved.
5. **Given** a waiting plan, **When** the user cancels the run, **Then** remaining pending tasks do not execute and the plan is left in a cancelled/failed-visible state.
6. **Given** Forge is restarted or the workbench is reopened while a plan is running or waiting, **When** the user returns to the chat, **Then** they still see the goal, task list, and current statuses.
7. **Given** existing Ask-user and mode-switch confirmations, **When** they occur inside a planned run, **Then** they attach to a waiting task in that plan rather than only living as a disconnected chat widget.
8. **Given** a fully idle waiting plan, **When** the user takes longer than the remaining wall-clock budget to answer, **Then** the run does not fail for maxExecutionTime; the 30-minute clock is paused while no work is in flight and resumes when work resumes.

---

### User Story 5 - Task kinds without a zoo of agents (Priority: P5)

Each task declares how it should be carried out: by a coding agent, by a direct tool/action, or by a human. Independent agent tasks may run as parallel in-session agents of the same kind. Named specialist personas (research vs testing vs review) are not required up front.

**Why this priority**: Executor types make the plan honest ("this step is a human", "this step is a tool") and allow parallel same-kind agents when the plan says work is independent. A circus of named specialist roles stays later.

**Independent Test**: Load a plan with one agent task, one direct-action task, and one human task. Confirm each is routed accordingly, and that a plan of only agent tasks still works with the existing coding agent.

**Acceptance Scenarios**:

1. **Given** a task marked for the coding agent, **When** it becomes ready, **Then** the existing agent performs that task with the usual project tools.
2. **Given** a task marked as a direct action (for example run tests or a single known tool), **When** it becomes ready, **Then** Forge carries it out without an extra "what next?" planning step, but still waits on existing approvals for install, deploy, destructive work, or mode switch.
3. **Given** a task marked as human, **When** it becomes ready, **Then** the run waits as in Story 4.
4. **Given** only the existing coding-agent kind is available, **When** a plan contains several independent agent tasks, **Then** they may run as parallel in-session agents; specialized named personas are not required.
5. **Given** a later addition of a distinct executor profile (for example a testing-focused agent), **When** a task targets that profile, **Then** other tasks in the plan are unaffected.

---

### Edge Cases

- The user sends a new request while a plan is running or waiting: the message is queued and does not interleave into the current graph. After the current run reaches a terminal status (completed, failed, or cancelled), a new run starts for the queued message.
- The user force-sends while a plan is running or waiting: the current run and all in-session agents cancel; pending tasks do not start; the force-sent message starts a new run immediately; any previously queued message is discarded.
- A human wait is open while independent agents are still running: those agents continue; dependents of the waiting task stay pending; no additional tasks start. The plan stays running and the time cap keeps ticking until no work is in flight.
- The planner returns an empty task list: Forge records a single task that is the user goal and executes that, or explains why it cannot plan, rather than hanging.
- The planner returns circular or missing dependencies: Forge rejects that plan, surfaces an error, and either asks the planner once more or fails the run with a visible reason.
- A non-idempotent side-effectful task fails: Forge does not repeat the same unsafe action; it fails the task or replans.
- A run hits 30 minutes of working time, 500000 LLM tokens, or 3.00 USD: the run stops with the budget reason visible, even if maxAttempts or maxReplans remain. Time spent in a fully idle wait on the user does not count toward the 30 minutes.
- The user cancels mid-task: the current task stops as far as existing cancellation allows; remaining pending tasks do not start.
- A task succeeds but produces empty or unusable output for a dependent task: the dependent task fails or triggers replan rather than running on missing input.
- Plan mode vs Agent mode on the same chat: switching modes does not duplicate or orphan the latest plan; Plan produces/updates the graph, Agent executes the current graph (or plans then executes if none exists).
- Very large plans: a plan version MUST have at most 20 tasks. Overflow is visible to the user; the planner must repair once or the run fails rather than executing an unbounded graph.
- Simple single-tool follow-ups after a completed plan ("run the tests again"): a small new plan or a single-task run is acceptable; Forge must not require the user to re-approve a long stale plan.
- Parallel in-session agents stay in the same chat session. Independent mutating work on the same repo may isolate on worktrees and MUST merge after those tasks complete, in completion order, into the session tree.
- A worktree merge is not clean: abort so the session tree is not half-merged; record conflict artifacts (paths, both sides, diffs, originating tasks); spawn a conflict-resolution in-session agent (existing coding-agent executor, not a named specialist) with those artifacts plus plan context; resolver may try at most twice, including relevant tests; every attempt is in the run trace. If still invalid, wait on the user (human resolution or replan) with conflict state and trace preserved. Dependents of the unmerged work stay pending.
- If adding a resolver task would exceed 20 tasks on this plan version, skip the auto-resolver and wait on the user with the conflict recorded.
- Parallel agents that do not use isolation and touch overlapping files: treat as a merge/overlap failure and follow the same record → resolve-or-wait path rather than silently corrupting the project.
- A plan has more independent ready tasks than free agent slots: extra tasks stay pending until a per-run or per-instance slot is free. Caps are 4 in-session agents per run and 10 per Forge instance.
- A workspace with multiple repos: independent tasks MAY target different available repos in the same session; missing or unconnected repos fail that task visibly rather than inventing a second chat.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST produce an explicit plan artifact for multi-step implementation work, including a stable id, a goal statement, an ordered set of tasks, and an overall status (`planned`, `running`, `waiting`, `completed`, `failed`, or `cancelled`).
- **FR-002**: Each task MUST include a stable id, a human-readable description, a status (`pending`, `running`, `waiting`, `completed`, `failed`, or `cancelled`), optional input/output/error summaries, and an executor kind (`agent`, `tool`/`action`, or `human`).
- **FR-003**: Each task MAY declare dependencies on other task ids in the same plan. A task MUST NOT start until every dependency is completed.
- **FR-004**: Tasks with no unmet dependencies MUST be treated as executable. Independent executable agent tasks MAY run as parallel in-session agents (explore or change; different repos or modules as the plan defines), subject to FR-024 and FR-025. Those agents MUST remain in the same chat session. Independent mutating work on the same repo MAY isolate on worktrees and MUST merge after those tasks complete. Dependent tasks MUST NOT start until every dependency is completed.
- **FR-005**: An agent task MUST be executable by a coding agent in the same chat session, using the same project tools and isolated session as today. For a planned run, the system MUST start ready tasks from the plan rather than inventing the next plan step from chat memory alone. The planner, not a hard-coded specialty roster, decides which tasks are independent.
- **FR-006**: The workbench MUST show the current plan’s goal, tasks, statuses, and (when relevant) wait reason, so a user can understand progress without reading the full tool transcript.
- **FR-007**: Plan mode MUST be able to produce or update the structured plan without mutating project source. Agent, Auto, Multitask, and Debug modes MUST run an LLM planning gate before planning: when `needsPlanning` is true they MUST execute Planner→DAG→Executor; when false they MUST use the existing ReAct chat path with no plan artifact. Ask mode MUST NOT create an execution plan.
- **FR-032**: The planning gate MUST return only `{ needsPlanning: boolean, reason: string }`. It MUST NOT create a plan, choose tools, or execute work. On gate LLM failure the system MUST bias to `needsPlanning: false` (under-plan). A wrong gate decision MUST NOT leave half-written plan state.
- **FR-008**: Users MUST be able to cancel a running or waiting plan (including via force send). Cancellation MUST stop in-session agents as far as cancellation allows and MUST prevent pending tasks from starting.
- **FR-021**: While a plan run is active (running or waiting), a normal new composer request MUST be queued and MUST NOT modify the current graph. The workbench MUST show that a follow-up is queued. After that run reaches completed, failed, or cancelled, the system MUST start a new run for the queued request.
- **FR-022**: A force send while a plan run is active MUST cancel that run and start a new run with the force-sent message. A force send MUST discard any message that was only queued.
- **FR-023**: Answers, skips, and form submissions on a waiting task MUST resume the same run and MUST NOT be treated as a queued new request.
- **FR-009**: Plan state MUST survive process restart, workbench reload, and leaving/returning to the chat, for running, waiting, completed, and failed runs.
- **FR-010**: Task-level failures (test, compile, or runtime errors on a repeatable task) MUST be retried as the same task up to maxAttempts of 3. Dependents MUST stay blocked while that task is retrying or failed.
- **FR-011**: When repeated task failure shows the original strategy is wrong (or maxAttempts is exhausted without success), the system MUST replan: produce a new DAG version, preserve still-valid completed tasks, and continue in the same run, up to maxReplans of 2 (original plan plus at most two new versions).
- **FR-012**: When maxReplans is reached and the goal is still unmet, the run MUST stop in a failed or waiting state with the last plan version and failure visible.
- **FR-026**: Side-effectful tasks MUST NOT be retried under FR-010 unless the task is idempotent (safe to repeat). Non-idempotent side-effectful failures MUST fail the task or trigger replan rather than blindly repeating the action.
- **FR-027**: Each run MUST enforce an overall workflow budget of maxExecutionTime 30 minutes of working time, maxLLMTokens 500000, and maxCost 3.00 USD. The run MUST stop when any of those caps is exceeded, even if task attempts or replans remain, and MUST show the budget reason on the plan.
- **FR-028**: maxExecutionTime MUST pause only while no in-session work is in flight (pure wait on the user). LLM token and cost counters MUST accrue only during work, including independent agents that continue during another task’s wait.
- **FR-013**: A task that needs a human MUST set that task’s status to waiting and record what it is waiting for. Tasks that depend on it MUST NOT start. Already-running independent in-session agents MUST continue. Additional tasks MUST NOT start while that wait is open. The overall plan status MUST be waiting only when no in-session work is in flight; otherwise it stays running. The same plan MUST resume when the user answers, skips, or cancels.
- **FR-014**: User answers to in-plan approval MUST NOT require the user to restate the original goal, and MUST NOT reset completed task statuses.
- **FR-015**: Direct-action tasks MUST run the specified action without an extra "what next?" planning step for that task. Direct-action MUST NOT skip existing human approvals (install, deploy, destructive work, or mode switch); those MUST become waiting tasks as in FR-013.
- **FR-016**: The planner MUST use structured output (Zod schema) for plan drafts. Plans MUST be constrained: at most 20 tasks per plan version, no cycles, every dependency id must exist, and every task must have a description and executor kind. Malformed or invalid planner output MUST be treated as a planner invocation failure with a bounded retry (at most one repair attempt); it MUST NOT trigger workflow replan. Workflow replan is reserved for cases where an already-valid plan becomes invalid during execution. Invalid plans MUST NOT execute as-is.
- **FR-017**: Conditional or follow-up work discovered during execution MUST be represented as tasks on the plan (via the original plan or a replan), not only as untracked tool calls.
- **FR-018**: Existing follow-up cards for later, out-of-scope work remain available. They MUST NOT replace the in-run task graph for the current goal.
- **FR-019**: Debug mode MAY use a plan for a multi-step investigation; it MUST still prefer a minimal fix and MUST NOT expand into unrelated implementation tasks without user-visible plan items.
- **FR-020**: Parallel in-session agents of the existing coding-agent kind ARE in scope for independent tasks and for bounded merge-conflict resolution. Named specialist collaboration (separate research, testing, review personas as a team) remains out of scope until Stories 1–4 work with that coding-agent kind plus tool and human executor kinds.
- **FR-024**: A single plan run MUST NOT have more than 4 in-session agents running at once. Additional ready independent tasks MUST stay pending until a per-run slot is free.
- **FR-025**: A Forge instance MUST NOT have more than 10 in-session agents running at once across all runs. Ready work MUST wait for an instance slot if the instance cap is reached, even if the per-run cap still has room.
- **FR-029**: When parallel in-session agents isolate on worktrees, the run MUST merge each completed isolated task back into the session tree in completion order before dependents that need that result start. The session working tree MUST NOT be left in a half-merged state.
- **FR-030**: When a worktree merge is not clean, the parent MUST record the conflict (affected files, diffs, originating tasks, plan context) in the run trace and MUST spawn a conflict-resolution sub-agent that uses the existing coding-agent executor (not a named specialist). That resolver MUST receive the conflict artifacts and plan/task context, MUST attempt to reconcile the changes, and MUST run relevant validation or tests. It MUST have its own bound of 2 attempts. Every attempt, change, test, and outcome MUST appear in the workflow trace.
- **FR-031**: If the conflict resolver does not produce a valid merge within 2 attempts, the run MUST wait on the user with the conflict state and trace preserved. The user MUST be able to resolve it or replan. Dependents MUST stay pending until a valid merge exists or the run is cancelled.

### Key Entities

- **Plan**: The durable record of one run toward a user goal. Holds identity, goal text, status, at most 20 tasks per version, revision history (DAG versions), retry/replan counters, overall budget (time, LLM tokens, cost), and timestamps.
- **Task**: One unit of work on a plan. Holds identity, description, executor kind, dependencies, status, optional wait reason, input, output, error, attempt count (max 3), and whether it is idempotent.
- **Run budget**: Per-run caps of 30 minutes working wall time, 500000 LLM tokens, and 3.00 USD. Exhausting any cap stops the run. Waiting on the user does not consume the time cap while no work is in flight.
- **Dependency**: A requires-completed-before-start relationship from one task to one or more other tasks in the same plan.
- **Run**: The live execution of a plan in a chat session. At most one plan run is active per chat at a time. A run MAY include several in-session agents at once for independent tasks, at most 4 running at once.
- **Queued request**: At most one follow-up user message waiting for the active run to finish. A later normal send replaces the queued request. Force send discards it.
- **In-session agent**: A coding-agent worker started by the run to carry out one (or a bound set of) ready agent task(s). It shares the user's chat session; it is not a separate chat and not a named specialist persona. It MAY isolate same-repo mutating work on a worktree and merge when the task completes. The same executor kind is used for bounded conflict-resolution sub-agents.
- **Merge conflict**: Recorded when a worktree merge is not clean. Holds originating task ids, affected paths, diffs / both sides, resolver attempt count (max 2), test outcomes, and whether the run is waiting on a human.
- **Wait**: A task-level pause for human approval, input, mode confirmation, or unresolved merge conflict. Independent already-running agents may continue; the plan is fully waiting only when nothing is in flight.
- **Revision**: A replan event that publishes a new DAG version while keeping the same plan identity and still-valid completed work. At most 2 replans per run.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For a multi-step implementation request in Agent or Auto, users can see a structured task list for that request in the workbench before source files are edited, in the same visit as sending the message (no extra navigation required).
- **SC-002**: During a run, users can correctly identify the current task and the status of every other task from the plan view alone in under 10 seconds, without reading the full transcript.
- **SC-003**: On a plan with at least two independent first tasks and one dependent later task, the dependent task never starts before both independents complete, in 100% of test runs.
- **SC-004**: On a plan with at least two independent first tasks (for example explore or edit different repos or modules), users can observe more than one of those tasks running at the same time via in-session agents, and the dependent task still starts only after they complete, without a user-imposed delay between the independent tasks.
- **SC-012**: A run with more than 4 independent ready agent tasks never has more than 4 in-session agents running at once, in 100% of test runs. Across the instance, in-session agents never exceed 10 at once.
- **SC-014**: A published plan version never contains more than 20 tasks, in 100% of test runs.
- **SC-013**: A single task is never attempted more than 3 times, and a run never publishes more than 2 replan DAG versions, in 100% of test runs. A run that hits 30 minutes of working time, 500000 tokens, or 3.00 USD stops with that reason visible even if attempts or replans remain. Time spent in a fully idle wait on the user does not count toward the 30 minutes; time with independent agents still working does count.
- **SC-005**: When a planned verification task fails in a way that shows the original strategy is wrong (for example a missing dependency) through its task attempts, at least 90% of such demonstration runs show a new plan version in the same visit that includes a new or changed task addressing that failure.
- **SC-006**: After an in-plan approval, users resume without retyping the original request, and previously completed tasks remain marked completed in 100% of demonstration runs.
- **SC-007**: After quitting and reopening Forge during a running or waiting plan, users recover the same goal and task statuses without creating a new chat, in 100% of demonstration runs.
- **SC-008**: Ask-mode questions produce no execution plan in 100% of test cases; Plan-mode requests produce a plan and no source mutations until the user continues in an implementing mode.
- **SC-009**: Users can cancel a running plan (including via force send) and confirm that no remaining pending task starts after cancellation, in 100% of test runs.
- **SC-011**: When a user sends a normal new request during a running plan, the current run reaches a terminal status before the queued request starts, in 100% of test runs; a force send starts the new request only after the previous run is cancelled.
- **SC-010**: After this feature, a developer who opens a completed multi-step run can explain the goal, the tasks, what ran in parallel, what waited on them, and what was replanned, using only the plan view and without reconstructing the story from raw tool logs.
- **SC-015**: When two parallel same-repo tasks conflict on merge, 100% of test runs either (a) reach a valid merge via at most 2 resolver-agent attempts with tests recorded in the trace, or (b) wait on the user with conflict paths and the trace preserved—never a half-merged session tree and never a named specialist-agent persona.

## Assumptions

- Target users are developers using Forge’s existing chat workbench on a connected workspace. No new product surface (board, ticket system, or pipeline designer) is required for v1.
- Each agent task still uses the existing coding-agent loop and project tools. Independent tasks MAY run as parallel in-session agents; this feature does not replace project tools, sandboxes, or previews.
- Agent, Auto, Multitask, and Debug run an LLM planning gate first: simple turns use ReAct only; multi-step / coordination work plans then executes. Plan mode always plans and waits. Ask mode never plans an execution graph. This maps onto today’s mode switcher rather than adding a new mode.
- In Agent/Auto/Multitask, publishing the plan does not require a separate "Approve plan" click; users who want review-before-edit use Plan mode, then continue in Agent. Users can still cancel once execution has started.
- Users cannot edit task text or reorder the graph by hand in v1. They cancel, force-send a new request, queue a follow-up, or answer waits.
- One active plan run per chat. A normal new request while a run is active is queued (single slot; a later normal send replaces it) and starts a new run after the current one finishes. Force send cancels the active run and starts a new run immediately.
- Retry is task-level (test, compile, runtime) with maxAttempts 3, and only when the task is idempotent if it has side effects. Replan is strategy-level: a new DAG version, maxReplans 2. Each run also stops if it exceeds 30 minutes of working time, 500000 LLM tokens, or 3.00 USD. A fully idle wait on the user does not consume the time cap; work that continues during another task’s wait does.
- Existing approval prompts, mode-switch confirmations, and install confirmations become waiting tasks when they occur inside a planned run (Story 4). Until Story 4 ships, answering those prompts may still start a fresh turn; the plan view is the source of truth once Story 4 lands.
- Follow-up cards stay for later, out-of-scope work. They are not the in-run task graph.
- Parallelism means the planner may mark tasks independent and the run may start parallel in-session agents for them (including independent changes, not only reads), up to 4 running agents per run and 10 per Forge instance. Extra ready tasks wait for a slot. Agents stay in the same chat session; same-repo independent mutations may use worktrees and merge after completion in completion order. Unclean merges follow FR-030/FR-031 (bounded same-kind resolver, then human wait). Isolation of repos/modules is the planner's call; the executor honors the graph, these caps, and merge-on-complete.
- Each plan version has at most 20 tasks. A planner that emits more must repair once or the run fails visibly.
- v1 concurrency caps are fixed (4 per run, 10 per instance). A later change MAY replace them with resource-aware, adaptive scheduling; that scheduler is out of scope for this spec.
- Branching is represented as tasks that become eligible when a condition is met, or via replan. A visual flowchart editor is out of scope.
- Named specialist-agent collaboration (research vs testing vs review personas) is out of scope until Stories 1–4 are useful with the existing coding-agent kind. Parallel same-kind in-session agents are in scope.
- Hand-authored static pipelines are not the source of truth for these runs. The plan is produced for the current user goal and stored as run state.
- Plan state lives with the chat run so waits, retries, and recovery are part of the same run the user already started. This spec does not require a new product or hosting model.
- Project constitution placeholders are not yet ratified; this spec follows existing Forge product boundaries (chat-only harness, local/desktop, tools run in an isolated session).
