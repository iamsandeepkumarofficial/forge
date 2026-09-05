import net from "node:net";

export const API_VERSION = "v1.43";
export const HTTP_CRLF = "\r\n";
export const N_101 = 101;
export const N_200 = 200;
export const N_300 = 300;
const N_2375 = 2375;

export type DockerEndpoint =
  | { kind: "unix"; socketPath: string }
  | { kind: "tcp"; host: string; port: number };

export function parseDockerEndpoint(
  dockerHost = process.env.DOCKER_HOST?.trim()
): DockerEndpoint {
  if (!dockerHost) {
    return { kind: "unix", socketPath: "/var/run/docker.sock" };
  }
  if (dockerHost.startsWith("unix://")) {
    return {
      kind: "unix",
      socketPath: decodeURIComponent(dockerHost.slice("unix://".length))
    };
  }
  const normalized = dockerHost.replace(/^tcp:\/\//, "http://");
  const url = new URL(normalized);
  const port = Number(url.port) || N_2375;
  return { kind: "tcp", host: url.hostname, port };
}

export function connectDocker(endpoint: DockerEndpoint): net.Socket {
  if (endpoint.kind === "unix") {
    return net.connect(endpoint.socketPath);
  }
  return net.connect(endpoint.port, endpoint.host);
}

export function decodeChunkedBody(input: Buffer): {
  body: Buffer;
  complete: boolean;
} {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < input.length) {
    const lineEnd = input.indexOf("\r\n", offset);
    if (lineEnd === -1) {
      return { body: Buffer.concat(chunks), complete: false };
    }
    const sizeLine = input
      .subarray(offset, lineEnd)
      .toString("utf8")
      .split(";")[0]
      ?.trim();
    const size = Number.parseInt(sizeLine ?? "", 16);
    if (!Number.isFinite(size)) {
      return { body: Buffer.concat(chunks), complete: false };
    }
    offset = lineEnd + 2;
    if (size === 0) {
      return { body: Buffer.concat(chunks), complete: true };
    }
    if (offset + size > input.length) {
      return { body: Buffer.concat(chunks), complete: false };
    }
    chunks.push(input.subarray(offset, offset + size));
    offset += size + 2;
  }
  return { body: Buffer.concat(chunks), complete: false };
}

export function isChunked(headerText: string): boolean {
  return /transfer-encoding:\s*chunked/i.test(headerText);
}

export function parseHttpResponse(buffer: Buffer): {
  statusCode: number;
  body: Buffer;
} {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    throw new Error("Incomplete HTTP response");
  }
  const headerText = buffer.subarray(0, headerEnd).toString("utf8");
  const statusMatch = headerText.match(/^HTTP\/\d(?:\.\d)? (\d+)/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
  const rest = buffer.subarray(headerEnd + 4);
  if (isChunked(headerText)) {
    const decoded = decodeChunkedBody(rest);
    if (!decoded.complete) {
      throw new Error("Incomplete chunked HTTP response");
    }
    return { statusCode, body: decoded.body };
  }
  const contentLengthMatch = headerText.match(/content-length:\s*(\d+)/i);
  if (contentLengthMatch) {
    const len = Number(contentLengthMatch[1]);
    return { statusCode, body: rest.subarray(0, len) };
  }
  return { statusCode, body: rest };
}

export function dockerApiError(text: string, fallback: string): Error {
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed.message) return new Error(parsed.message);
  } catch {
    void 0;
  }
  return new Error(text || fallback);
}
