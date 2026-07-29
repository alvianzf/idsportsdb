import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { isConnectionError } from "../lib/prismaErrors.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Ukuran file terlalu besar" });
      return;
    }
    res.status(400).json({ error: "Gagal mengunggah file" });
    return;
  }

  // Correlates the client's response with the stack trace below, so a report of
  // "it broke" can be traced to one log line instead of a guess.
  const requestId = randomUUID().slice(0, 8);
  console.error(`[${requestId}] ${req.method} ${req.originalUrl}`, err);

  // A database outage is not the caller's fault: 503 tells clients and uptime
  // monitors to retry, and separates "infrastructure down" from "handler bug".
  if (isConnectionError(err)) {
    res.status(503).json({
      error: "Database tidak dapat dihubungi, coba lagi sebentar lagi",
      code: "DB_UNAVAILABLE",
      requestId,
    });
    return;
  }

  res.status(500).json({ error: "Internal server error", requestId });
};
