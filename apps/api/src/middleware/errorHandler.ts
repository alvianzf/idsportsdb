import type { ErrorRequestHandler } from "express";
import multer from "multer";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Ukuran file terlalu besar" });
      return;
    }
    res.status(400).json({ error: "Gagal mengunggah file" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
