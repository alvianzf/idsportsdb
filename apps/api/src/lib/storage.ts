import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { env } from "../config/env.js";

export const uploadRoot = path.resolve(env.uploadDir);

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** Accepts image files only. */
export const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  cb(null, /^image\//.test(file.mimetype));
};

/** Accepts JPEG images and PDFs only (license scans, revisi 2026-07-18). */
export const pdfOrJpgFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  cb(null, file.mimetype === "image/jpeg" || file.mimetype === "application/pdf");
};

/** Accepts image files and PDFs (documents/certificates). */
export const documentFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  cb(null, /^image\//.test(file.mimetype) || file.mimetype === "application/pdf");
};

/** Multer instance storing uploaded files under `uploads/<subdir>/`. */
export function uploader(
  subdir: string,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  fileFilter?: multer.Options["fileFilter"],
) {
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

  return multer({ storage, limits: { fileSize: maxFileSize }, fileFilter });
}

/** Public URL for a file stored via `uploader`, served from `/uploads`. */
export function publicUrl(subdir: string, filename: string): string {
  return `/uploads/${subdir}/${filename}`;
}
