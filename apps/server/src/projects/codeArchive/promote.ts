import { spawn } from "node:child_process";
import * as tar from "tar-stream";
import { dockerExec } from "../sandboxExec.js";
import { parseGithubSlug } from "@forge/core";
import {
  deleteObjectsWithPrefix,
  putObject
} from "../../services/storage/objectStore.js";
import type { Project } from "@forge/db";

const EXCLUDES = [
  "--exclude=./.git",
  "--exclude=*/.git",
  "--exclude=./node_modules",
  "--exclude=*/node_modules"
];

interface TarExtractStream extends NodeJS.WritableStream {
  on(
    event: "entry",
    cb: (
      ...args: [
        headers: {
          name: string;
          type?: string;
        },
        stream: NodeJS.ReadableStream,
        next: () => void
      ]
    ) => void
  ): this;
  on(event: "finish", cb: () => void): this;
  on(event: "error", cb: (err: Error) => void): this;
}

async function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

export async function promoteGithubBranch(options: {
  containerName: string;
  workingDir: string;
  project: Project;
  branch: string;
}): Promise<{ target: "github"; branch: string }> {
  if (!parseGithubSlug(options.project.dedupeKey)) {
    throw new Error(`Invalid GitHub slug: ${options.project.dedupeKey}`);
  }
  const r = await dockerExec({
    container: options.containerName,
    argv: [
      "sh",
      "-c",
      'cd "$WD" && git config user.email "forge@local" && git config user.name "Forge Agent" && ' +
        'git add -A && (git commit -q -m "forge: promote working changes" || true) && ' +
        'git push origin "HEAD:$BRANCH"'
    ],
    env: { WD: options.workingDir, BRANCH: options.branch }
  });
  if (r.code !== 0) {
    throw new Error(r.stderr.trim() || "git push failed");
  }
  return { target: "github", branch: options.branch };
}

export async function promoteObjectStoreArchive(options: {
  containerName: string;
  workingDir: string;
  repoPrefix: string;
}): Promise<{ target: "objectStore"; files: number }> {
  const bucket = process.env.OBJECT_STORE_BUCKET || "projects";
  await deleteObjectsWithPrefix(bucket, options.repoPrefix);
  const child = spawn(
    "docker",
    [
      "exec",
      options.containerName,
      "sh",
      "-c",
      `cd "${options.workingDir}" && tar cf - ${EXCLUDES.join(" ")} .`
    ],
    { env: process.env }
  );
  const extract = (
    tar as unknown as {
      extract(): TarExtractStream;
    }
  ).extract();
  let files = 0;
  const done = new Promise<void>((resolve, reject) => {
    extract.on("entry", (...entryArgs) => {
      const [headers, stream, next] = entryArgs;
      if (headers.type !== "file") {
        stream.resume();
        stream.on("end", next);
        return;
      }
      const name = headers.name.replace(/^\.\//, "");
      collectStream(stream)
        .then((buf) =>
          putObject({
            bucket,
            key: `${options.repoPrefix}/${name}`,
            body: buf
          })
        )
        .then(() => {
          files++;
          next();
        })
        .catch(reject);
    });
    extract.on("finish", () => resolve());
    extract.on("error", reject);
  });
  child.stdout.pipe(extract as unknown as NodeJS.WritableStream);
  child.on("error", (e) => extract.emit("error", e));
  await done;
  return { target: "objectStore", files };
}

export { EXCLUDES };
