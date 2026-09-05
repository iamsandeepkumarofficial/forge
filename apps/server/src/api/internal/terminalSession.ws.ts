import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket, type RawData } from "ws";
import {
  parseDataFrame,
  parseSessionUrl,
  SESSION_WS_PATH
} from "./terminalSessionProtocol.js";
import {
  closeAllStreams,
  handleSocketMessage,
  type StreamHandle
} from "./terminalSessionHandlers.js";

const N_1008 = 1008;

async function handleSessionSocket(
  ws: WebSocket,
  requestUrl: string | undefined
): Promise<void> {
  const params = parseSessionUrl(requestUrl);
  if (!params) {
    ws.close(N_1008, "sessionId required");
    return;
  }
  const { sessionId } = params;
  const streams = new Map<string, StreamHandle>();
  const pending = new Map<string, Promise<StreamHandle>>();
  let closed = false;

  const closeAll = () => {
    closeAllStreams({
      ws,
      streams,
      pending,
      alreadyClosed: closed,
      markClosed: () => {
        closed = true;
      }
    });
  };

  ws.on("close", closeAll);
  ws.on("error", closeAll);

  ws.on("message", (data: RawData, isBinary: boolean) => {
    handleSocketMessage({
      ws,
      sessionId,
      data,
      isBinary,
      streams,
      pending,
      isClosed: () => closed
    });
  });
}

export function attachTerminalSessionWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, ...rest) => {
    const [socket, head] = rest;
    const pathname = request.url
      ? new URL(request.url, "http://localhost").pathname
      : "";
    if (pathname !== SESSION_WS_PATH) return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      void handleSessionSocket(ws, request.url);
    });
  });
}

export { parseDataFrame };
