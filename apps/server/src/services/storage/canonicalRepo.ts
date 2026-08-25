import * as fs from "node:fs/promises";
import * as path from "node:path";
export class CanonicalRepo {
  private static locks: Map<string, Promise<void>> = new Map();
  async acquireLock(projectId: string): Promise<() => void> {
    const lockKey = `canonical:${projectId}`;
    let release!: () => void;
    if (!CanonicalRepo.locks.has(lockKey)) {
      CanonicalRepo.locks.set(
        lockKey,
        new Promise<void>((resolve) => {
          release = resolve;
        })
      );
    }
    await CanonicalRepo.locks.get(lockKey)!;
    return () => release();
  }
  async releaseLock(projectId: string): Promise<void> {
    const lockKey = `canonical:${projectId}`;
    CanonicalRepo.locks.delete(lockKey);
  }
  async syncToBucket(options: {
    projectId: string;
    bucket: string;
    key: string;
  }): Promise<void> {
    const { projectId } = options;
    try {
      await fs.mkdir(path.join(process.cwd(), ".bare-repo", projectId), {
        recursive: true
      });
      await fs.mkdir(
        path.join(process.cwd(), ".bare-repo", projectId, "objects"),
        { recursive: true }
      );
    } finally {
      await this.releaseLock(projectId);
    }
  }
  async cloneFromBucket(options: {
    projectId: string;
    bucket: string;
    key: string;
  }): Promise<void> {
    const { projectId } = options;
    const targetDir = path.join(
      process.cwd(),
      ".bare-repo",
      `${projectId}-clone`
    );
    try {
      await fs.mkdir(targetDir, { recursive: true });
    } finally {
      await this.releaseLock(projectId);
    }
  }
}
