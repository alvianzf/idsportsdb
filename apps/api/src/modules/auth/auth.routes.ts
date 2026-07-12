import fs from "node:fs";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { uploader, publicUrl } from "../../lib/storage.js";
import { authenticate } from "../../middleware/auth.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { loginSchema, refreshSchema, updateUserSchema } from "./auth.schema.js";
import * as authService from "./auth.service.js";
import { toSafeUser } from "../users/users.service.js";
import { sendPasswordResetEmail } from "../../lib/email.js";

export const authRouter = Router();

authRouter.post(
  "/login",
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

    res.json(result);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = await authService.refresh(parsed.data.refreshToken);
    if (!result) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    res.json(result);
  }),
);

// Stateless JWT refresh tokens (no server-side revocation list) for v1 — see
// specs/001-auth-rbac/spec.md §7. Logout simply tells the client to discard
// its tokens.
authRouter.post("/logout", authenticate, (_req, res) => {
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

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: publicUrl("avatar", req.file.filename) },
    });
    res.json(toSafeUser(user));
  }),
);
