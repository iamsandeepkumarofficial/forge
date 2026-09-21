export {
  ConnectProjectError,
  type ProjectSummary,
  type ChatSummary,
  type SessionStatus,
  type ChatFeatureType,
  type DescriptionDocument
} from "./shared.js";
export {
  connectProject,
  connectLocalProject,
  fetchPrimaryWorkspace,
  fetchProjects,
  fetchProject,
  deleteProject
} from "./projects.js";
export {
  createChat,
  fetchChats,
  fetchChat,
  updateChat,
  deleteChat
} from "./chats.js";
export { type ChatComment, fetchComments, createComment } from "./comments.js";
export { startSession, getSessionStatus, pushToSession } from "./sessions.js";
export {
  type ChatAttachment,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  downloadAttachmentUrl
} from "./attachments.js";
export {
  type LinkedItem,
  listLinkedItems,
  createLinkedItem,
  deleteLinkedItem
} from "./linked-items.js";
export {
  type ChatFeatureKind,
  type ProjectWorkbenchSession,
  createWorkbenchSession,
  fetchWorkbenchSessions
} from "./workbench.js";
export {
  type ActivityFilter,
  type ActivityEntry,
  type ActivityFeed,
  getActivity
} from "./activity.js";
