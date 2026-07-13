import { io, type Socket } from "socket.io-client";

const socketUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(
  /\/api\/v1\/?$/,
  "",
);

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketUrl, { path: "/socket.io", transports: ["websocket", "polling"] });
  }
  return socket;
}
