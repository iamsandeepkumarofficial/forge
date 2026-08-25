import { ActivityRepository } from "../../catalog/activityRepository.js";
import { ChatCommentRepository } from "../../catalog/chatCommentRepository.js";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { DocumentRepository } from "../../catalog/documentRepository.js";
const CARD_STATUSES = new Set([
  "no_section",
  "planning",
  "development",
  "qa",
  "done"
]);
export class BoardService {
  private chatFeatureRepo = new ChatFeatureRepository();
  private chatCommentRepo = new ChatCommentRepository();
  private activityRepo = new ActivityRepository();
  private documentRepo = new DocumentRepository();
  async getCard(id: string) {
    return this.chatFeatureRepo.getById(id);
  }
  validateStatus(status: string): boolean {
    return CARD_STATUSES.has(status);
  }
  allowedStatuses(): string[] {
    return [...CARD_STATUSES];
  }
  async updateCardStatus(id: string, status: string) {
    const card = await this.chatFeatureRepo.getById(id);
    if (!card) {
      return null;
    }
    const oldStatus = card.status;
    await this.chatFeatureRepo.update({
      ...card,
      status: status as typeof card.status
    });
    await this.chatFeatureRepo.updateLastActivity(id);
    if (oldStatus !== status) {
      await this.activityRepo.create({
        chatFeatureId: id,
        kind: "history",
        actorType: "system",
        agentId: null,
        userId: null,
        summary: `Status changed from ${oldStatus} to ${status}`,
        detail: { field: "status", from: oldStatus, to: status }
      });
    }
    return this.chatFeatureRepo.getById(id);
  }
  async addWorklog(
    id: string,
    input: {
      agentId: string;
      summary: string;
      detail: Record<string, unknown> | null;
    }
  ) {
    const card = await this.chatFeatureRepo.getById(id);
    if (!card) {
      return null;
    }
    const created = await this.activityRepo.create({
      chatFeatureId: id,
      kind: "worklog",
      actorType: "agent",
      agentId: input.agentId,
      userId: null,
      summary: input.summary,
      detail: input.detail
    });
    await this.chatFeatureRepo.updateLastActivity(id);
    return created;
  }
  async addComment(
    id: string,
    input: {
      text: string;
      agentId?: string;
      stageId?: string;
      commentTitle?: string;
      createDocument?: boolean;
    }
  ) {
    const card = await this.chatFeatureRepo.getById(id);
    if (!card) {
      return null;
    }
    let finalText = input.text;
    let documentId: string | null = null;
    const createDocument =
      input.createDocument === true ||
      Boolean(input.agentId && input.stageId && input.commentTitle);
    if (createDocument) {
      const doc = await this.documentRepo.create({
        userId: card.userId,
        projectId: card.projectId,
        title:
          input.commentTitle || `Stage report (${input.stageId || "unknown"})`,
        body: input.text,
        source: "agent",
        agentId: input.agentId || null,
        chatFeatureId: id,
        stageId: input.stageId || null
      });
      documentId = doc.id;
      finalText = `${input.text}\n\n📄 [Open report](/projects/${card.projectId}/documents/${doc.id})`;
    }
    const comment = await this.chatCommentRepo.create({
      chatFeatureId: id,
      userId: card.userId,
      text: finalText
    });
    await this.chatFeatureRepo.updateLastActivity(id);
    return { ...comment, documentId };
  }
}
