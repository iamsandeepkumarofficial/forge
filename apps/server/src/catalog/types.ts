export type ProjectCanonical =
  | {
      kind: "github";
      ownerRepo: string;
      cloneUrl: string;
    }
  | {
      kind: "objectStore";
      bucket: string;
      key: string;
    }
  | {
      kind: "localFolder";
      path: string;
    };
export type Project = {
  id: string;
  userId: string;
  name: string;
  source: "github" | "upload" | "local";
  canonical: ProjectCanonical;
  dedupeKey: string;
  status: "available" | "unavailable";
  createdAt: number;
  lastActivityAt: number;
};
export type ChatFeatureStatus = "todo" | "in_progress" | "done";
export type ChatFeature = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  status: ChatFeatureStatus;
  order: number;
  branchName: string;
  sessionId: string;
  createdAt: number;
  lastActivityAt: number;
};
export type CanonicalLocation = {
  kind: "github" | "objectStore";
  ownerRepo?: string;
  bucket?: string;
  key?: string;
  cloneUrl?: string;
};
