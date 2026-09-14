import net from "node:net";
import {
  API_VERSION,
  HTTP_CRLF,
  N_101,
  N_200,
  N_300,
  connectDocker,
  decodeChunkedBody,
  dockerApiError,
  parseDockerEndpoint,
  parseHttpResponse,
  isChunked,
  type DockerEndpoint
} from "./dockerExecHttpCodec.js";

export {
  parseDockerEndpoint,
  decodeChunkedBody,
  parseHttpResponse,
  isChunked,
  type DockerEndpoint
} from "./dockerExecHttpCodec.js";

async function dockerJsonRequest(options: {
  endpoint: DockerEndpoint;
  method: string;
  path: string;
  body?: unknown;
}): Promise<{ statusCode: number; json: Record<string, unknown> }> {
  const { endpoint, method, path, body } = options;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const headers = [
    `${method} /${API_VERSION}${path} HTTP/1.1`,
    "Host: localhost",
    payload ? "Content-Type: application/json" : null,
    payload ? `Content-Length: ${Buffer.byteLength(payload)}` : null,
    "Connection: close",
    "",
    ""
  ]
    .filter((line): line is string => line !== null)
    .join(HTTP_CRLF);
  const socket = connectDocker(endpoint);
  const response = await readHttpResponse(socket, headers + (payload ?? ""));
  const text = response.body.toString("utf8").trim();
  if (response.statusCode < N_200 || response.statusCode >= N_300) {
    throw dockerApiError(text, `Docker API ${method} ${path} failed`);
  }
  return {
    statusCode: response.statusCode,
    json: text ? (JSON.parse(text) as Record<string, unknown>) : {}
  };
}

function readHttpResponse(
  socket: net.Socket,
  request: string
): Promise<{ statusCode: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn();
    };
    const tryResolve = () => {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return false;
      const headerText = buffer.subarray(0, headerEnd).toString("utf8");
      const rest = buffer.subarray(headerEnd + 4);
      if (isChunked(headerText)) {
        const decoded = decodeChunkedBody(rest);
        if (!decoded.complete) return false;
        const statusMatch = headerText.match(/^HTTP\/\d(?:\.\d)? (\d+)/);
        finish(() =>
          resolve({
            statusCode: statusMatch ? Number(statusMatch[1]) : 0,
            body: decoded.body
          })
        );
        return true;
      }
      const contentLengthMatch = headerText.match(/content-length:\s*(\d+)/i);
      if (contentLengthMatch) {
        const len = Number(contentLengthMatch[1]);
        if (rest.length < len) return false;
        finish(() => resolve(parseHttpResponse(buffer)));
        return true;
      }
      return false;
    };
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      tryResolve();
    };
    const onDone = () => {
      try {
        finish(() => resolve(parseHttpResponse(buffer)));
      } catch (err) {
        finish(() =>
          reject(err instanceof Error ? err : new Error(String(err)))
        );
      }
    };
    socket.on("data", onData);
    socket.on("error", (err) => finish(() => reject(err)));
    socket.on("end", onDone);
    socket.on("close", onDone);
    socket.write(request);
  });
}

function hijackDockerStream(options: {
  endpoint: DockerEndpoint;
  method: string;
  path: string;
  body: string;
}): Promise<{ socket: net.Socket; initial: Buffer }> {
  const { endpoint, method, path, body } = options;
  return new Promise((resolve, reject) => {
    const socket = connectDocker(endpoint);
    let buffer = Buffer.alloc(0);
    const headerBlock = [
      `${method} /${API_VERSION}${path} HTTP/1.1`,
      "Host: localhost",
      "Content-Type: application/json",
      "Connection: Upgrade",
      "Upgrade: tcp",
      `Content-Length: ${Buffer.byteLength(body)}`,
      "",
      ""
    ].join(HTTP_CRLF);
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      socket.off("data", onData);
      const headerText = buffer.subarray(0, headerEnd).toString("utf8");
      const statusMatch = headerText.match(/^HTTP\/\d(?:\.\d)? (\d+)/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
      if (statusCode !== N_101 && statusCode !== N_200) {
        const rest = buffer.subarray(headerEnd + 4);
        let errText = headerText.split("\r\n")[0] || "Docker hijack failed";
        try {
          if (/transfer-encoding:\s*chunked/i.test(headerText)) {
            const decoded = decodeChunkedBody(rest);
            if (decoded.complete && decoded.body.length > 0) {
              errText = decoded.body.toString("utf8");
            }
          } else if (rest.length > 0) {
            errText = rest.toString("utf8");
          }
        } catch {
          void 0;
        }
        socket.destroy();
        reject(new Error(errText.trim() || "Docker hijack failed"));
        return;
      }
      resolve({
        socket,
        initial: buffer.subarray(headerEnd + 4)
      });
    };
    socket.on("error", reject);
    socket.write(headerBlock + body);
    socket.on("data", onData);
  });
}

export function dockerExecResizePath(options: {
  execId: string;
  cols: number;
  rows: number;
}): string {
  const w = Math.max(1, Math.floor(options.cols));
  const h = Math.max(1, Math.floor(options.rows));
  return `/exec/${options.execId}/resize?w=${w}&h=${h}`;
}

export type DockerExecAttach = {
  execId: string;
  write: (data: Buffer | string) => void;
  resize: (cols: number, rows: number) => Promise<void>;
  close: () => void;
};

export type DockerExecAttachOptions = {
  container: string;
  cmd: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
  endpoint?: DockerEndpoint;
  onData: (chunk: Buffer) => void;
  onClose: (code: number | null) => void;
};

export async function dockerExecAttach(
  options: DockerExecAttachOptions
): Promise<DockerExecAttach> {
  const endpoint = options.endpoint ?? parseDockerEndpoint();
  const create = await dockerJsonRequest({
    endpoint,
    method: "POST",
    path: `/containers/${encodeURIComponent(options.container)}/exec`,
    body: {
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: options.cmd,
      WorkingDir: options.cwd,
      Env: ["TERM=xterm-256color"]
    }
  });
  const execId = String(create.json.Id ?? "");
  if (!execId) {
    throw new Error("Docker exec create returned no id");
  }
  const { socket, initial } = await hijackDockerStream({
    endpoint,
    method: "POST",
    path: `/exec/${execId}/start`,
    body: JSON.stringify({ Detach: false, Tty: true })
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    socket.destroy();
    options.onClose(null);
  };
  const emit = (chunk: Buffer) => {
    if (closed || chunk.length === 0) return;
    options.onData(chunk);
  };
  if (initial.length > 0) {
    emit(initial);
  }
  socket.on("data", emit);
  socket.on("close", () => {
    if (!closed) {
      closed = true;
      options.onClose(null);
    }
  });
  socket.on("error", () => {
    if (!closed) {
      closed = true;
      options.onClose(null);
    }
  });
  const resize = async (cols: number, rows: number) => {
    try {
      await dockerJsonRequest({
        endpoint,
        method: "POST",
        path: dockerExecResizePath({ execId, cols, rows }),
        body: undefined
      });
    } catch {
      void 0;
    }
  };
  if (options.cols && options.rows) {
    await resize(options.cols, options.rows);
  }
  return {
    execId,
    write: (data) => {
      if (!closed) socket.write(data);
    },
    resize,
    close
  };
}

export type DockerLogFollowAttachOptions = {
  container: string;
  logPath: string;
  tailLines?: number;
  endpoint?: DockerEndpoint;
  onData: (chunk: Buffer) => void;
  onClose: (code: number | null) => void;
};

export async function dockerLogFollowAttach(
  options: DockerLogFollowAttachOptions
): Promise<{ close: () => void }> {
  const endpoint = options.endpoint ?? parseDockerEndpoint();
  const tailLines = Math.max(0, Math.floor(options.tailLines ?? 0));
  const create = await dockerJsonRequest({
    endpoint,
    method: "POST",
    path: `/containers/${encodeURIComponent(options.container)}/exec`,
    body: {
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ["tail", "-n", String(tailLines), "-F", options.logPath]
    }
  });
  const execId = String(create.json.Id ?? "");
  if (!execId) {
    throw new Error("Docker exec create returned no id");
  }
  const { socket, initial } = await hijackDockerStream({
    endpoint,
    method: "POST",
    path: `/exec/${execId}/start`,
    body: JSON.stringify({ Detach: false, Tty: true })
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    socket.destroy();
    options.onClose(null);
  };
  const emit = (chunk: Buffer) => {
    if (closed || chunk.length === 0) return;
    options.onData(chunk);
  };
  if (initial.length > 0) {
    emit(initial);
  }
  socket.on("data", emit);
  socket.on("close", () => {
    if (!closed) {
      closed = true;
      options.onClose(null);
    }
  });
  socket.on("error", () => {
    if (!closed) {
      closed = true;
      options.onClose(null);
    }
  });
  return { close };
}
