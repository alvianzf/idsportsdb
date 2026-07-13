import { createServer } from "node:http";
import { Server } from "socket.io";

type HttpServer = ReturnType<typeof createServer>;

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
  });

  io.on("connection", (_socket) => {
    // clients connect to receive push notifications only; no inbound events needed
  });

  return io;
}

/** Emit a realtime event to all connected clients. Call from route handlers after mutations. */
export function emit(event: string, data?: unknown): void {
  io?.emit(event, data);
}
