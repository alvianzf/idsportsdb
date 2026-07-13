import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { env } from "../config/env.js";

export const uploadRoot = path.resolve(env.uploadDir);

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** Multer instance storing uploaded files under `uploads/<subdir>/`. */
export function uploader(subdir: string, maxFileSize = DEFAULT_MAX_FILE_SIZE) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(uploadRoot, subdir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    },
  });

  return multer({ storage, limits: { fileSize: maxFileSize } });
}

/** Public URL for a file stored via `uploader`, served from `/uploads`. */
export function publicUrl(subdir: string, filename: string): string {
  return `/uploads/${subdir}/${filename}`;
}
