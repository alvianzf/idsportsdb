import fs from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { uploader, publicUrl, uploadRoot } from "../../lib/storage.js";
import { authenticate } from "../../middleware/auth.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { loginSchema, updateUserSchema } from "./auth.schema.js";
import * as authService from "./auth.service.js";
import { toSafeUser } from "../users/users.service.js";
import { sendPasswordResetEmail } from "../../lib/email.js";

export const authRouter = Router();

// Refresh token lives in an httpOnly cookie scoped to the auth routes so JS
// (and any XSS) can't read it. Path matches this router's mount point so the
// browser only sends it to /refresh and /logout. See issue #4.
const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/auth";
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}

// Throttle brute-force / mail-bomb surfaces: login, forgot-password, reset-password.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan. Coba lagi nanti." },
});

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = await authService.login(parsed.data.email, parsed.data.password);
    if (!result) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const { refreshToken, ...body } = result;
    setRefreshCookie(res, refreshToken);
    res.json(body);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    // Prefer the httpOnly cookie; fall back to the body for backward compat.
    const token =
      (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
      (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined);

    if (!token) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const result = await authService.refresh(token);
    if (!result) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const { refreshToken, ...body } = result;
    setRefreshCookie(res, refreshToken);
    res.json(body);
  }),
);

// Stateless JWT refresh tokens (no server-side revocation list) for v1 — see
// specs/001-auth-rbac/spec.md §7. Logout clears the refresh cookie and tells
// the client to discard its in-memory access token.
authRouter.post("/logout", authenticate, (_req, res) => {
  clearRefreshCookie(res);
  res.status(204).send();
});

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getActiveUserById(req.user!.id);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json({ user });
  }),
);

// ── Forgot / reset password ───────────────────────────────────────────────

authRouter.post(
  "/forgot-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email?: string };
    // Always return 204 regardless of whether the email exists (anti-enumeration)
    if (!email || typeof email !== "string") { res.status(204).send(); return; }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user && user.isActive) {
      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: token, passwordResetExpiry: expiry },
      });

      sendPasswordResetEmail({ to: user.email, fullName: user.fullName, resetToken: token })
        .then(() => console.log(`[email] reset sent → ${user.email}`))
        .catch((err) => console.error(`[email] reset FAILED → ${user.email}:`, err?.message ?? err));
    }

    res.status(204).send();
  }),
);

authRouter.post(
  "/reset-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token || !password || typeof token !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Token dan kata sandi baru diperlukan." });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Kata sandi minimal 8 karakter." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });

    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      res.status(400).json({ error: "Tautan reset tidak valid atau sudah kedaluwarsa." });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    res.status(204).send();
  }),
);

authRouter.patch(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { password, isActive, ...rest } = parsed.data;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...rest,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    res.json(toSafeUser(user));
  }),
);

const avatarUpload = uploader("avatar");

function unlinkUpload(url: string) {
  fs.unlink(path.join(uploadRoot, url.replace("/uploads/", "")), () => undefined);
}

authRouter.post(
  "/me/avatar",
  authenticate,
  avatarUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "File gambar wajib diunggah" });
      return;
    }
    if (!req.file.mimetype.startsWith("image/")) {
      fs.unlink(req.file.path, () => undefined);
      res.status(400).json({ error: "File harus berupa gambar (JPG/PNG/WebP)" });
      return;
    }

    const previous = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { avatarUrl: true },
    });
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: publicUrl("avatar", req.file.filename) },
    });
    if (previous?.avatarUrl) unlinkUpload(previous.avatarUrl);
    res.json(toSafeUser(user));
  }),
);

authRouter.delete(
  "/me/avatar",
  authenticate,
  asyncHandler(async (req, res) => {
    const previous = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { avatarUrl: true },
    });
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: null },
    });
    if (previous?.avatarUrl) unlinkUpload(previous.avatarUrl);
    res.json(toSafeUser(user));
  }),
);
