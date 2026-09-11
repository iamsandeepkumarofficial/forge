import { randomUUID } from "node:crypto";
import type { SessionMessage } from "@forge/db";
import {
  ChatTurnRepository,
  SessionMessageRepository
} from "../catalog/sessionChatRepository.js";
import {
  livePrefixThrough,
  orderedTurnIds
} from "../catalog/sessionBranchCopy.js";
import {
  copyCheckpointSidecar,
  restorePlanAfterTurn,
  restoreSessionWorkspace,
  type RestoreEntry
} from "./workspaceCheckpoint.js";
import { cloneSessionWorkingTree } from "./sessionWorkspaceClone.js";

export type BranchSessionResult = {
  copied: number;
  workspaceCloned: boolean;
};

export async function branchSessionFromMessage(options: {
  sourceSessionId: string;
  targetSessionId: string;
  untilMessageId: string;
  live: SessionMessage[];
  messages?: SessionMessageRepository;
  turns?: ChatTurnRepository;
  cloneWorkspace?: (opts: {
    sourceSessionId: string;
    targetSessionId: string;
  }) => Promise<void>;
  restoreWorkspace?: (opts: {
    sessionId: string;
    plan: RestoreEntry[];
  }) => Promise<void>;
}): Promise<BranchSessionResult> {
  const prefix = livePrefixThrough(options.live, options.untilMessageId);
  if (!prefix) {
    throw new Error("message not found");
  }
  const fork = prefix[prefix.length - 1]!;
  const cloneWorkspace = options.cloneWorkspace ?? cloneSessionWorkingTree;
  await cloneWorkspace({
    sourceSessionId: options.sourceSessionId,
    targetSessionId: options.targetSessionId
  });
  if (fork.turnId) {
    const plan = await restorePlanAfterTurn({
      sessionId: options.sourceSessionId,
      turnId: fork.turnId,
      turns: options.turns
    });
    if (plan.length > 0) {
      const restore = options.restoreWorkspace ?? restoreSessionWorkspace;
      await restore({
        sessionId: options.targetSessionId,
        plan
      });
    }
  }
  const turns = options.turns ?? new ChatTurnRepository();
  const messages = options.messages ?? new SessionMessageRepository();
  const turnIdMap = new Map<string, string>();
  for (const oldTurnId of orderedTurnIds(prefix)) {
    const sourceTurn = await turns.getById(oldTurnId);
    if (!sourceTurn || sourceTurn.sessionId !== options.sourceSessionId) {
      continue;
    }
    const newTurnId = randomUUID();
    await turns.cloneCompleted({
      id: newTurnId,
      sessionId: options.targetSessionId,
      workflowId: `copied:${options.targetSessionId}:${newTurnId}`,
      source: sourceTurn
    });
    await copyCheckpointSidecar({
      sourceSessionId: options.sourceSessionId,
      sourceTurnId: oldTurnId,
      targetSessionId: options.targetSessionId,
      targetTurnId: newTurnId
    });
    turnIdMap.set(oldTurnId, newTurnId);
  }
  const copied = await messages.copyUntil({
    sourceSessionId: options.sourceSessionId,
    targetSessionId: options.targetSessionId,
    untilMessageId: options.untilMessageId,
    turnIdMap
  });
  return { copied, workspaceCloned: true };
}
