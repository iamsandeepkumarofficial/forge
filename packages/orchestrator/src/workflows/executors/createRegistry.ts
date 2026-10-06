import type { PlanRunContext } from "../agentPlanTypes.js";
import { buildAgentChildArgs } from "../agentChildArgs.js";
import { AgentExecutor } from "./agent.js";
import { HumanExecutor } from "./human.js";
import { ToolExecutor, type ExecuteDirectToolFn } from "./tool.js";
import { ExecutorRegistry } from "./registry.js";

export function createDefaultExecutorRegistry(
  ctx: PlanRunContext,
  executeDirectTool: ExecuteDirectToolFn
): ExecutorRegistry {
  return new ExecutorRegistry()
    .register(
      "agent",
      new AgentExecutor({
        buildChildArgs: async (task) => buildAgentChildArgs({ ctx, task })
      })
    )
    .register("human", new HumanExecutor())
    .register("tool", new ToolExecutor(executeDirectTool));
}
