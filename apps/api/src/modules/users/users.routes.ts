import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import {
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
} from "../../lib/prismaErrors.js";
import { sendWelcomeEmail, sendPasswordResetByAdminEmail } from "../../lib/email.js";

function generatePassword(): string {
  // 12 printable characters — URL-safe base64 subset
  return randomBytes(16).toString("base64url").slice(0, 12);
}
import {
  createUserSchema,
  updateUserRoleSchema,
  updateUserSchema,
} from "../auth/auth.schema.js";
import { listUsersQuerySchema } from "./users.schema.js";
import { toSafeUser } from "./users.service.js";

export const usersRouter = Router();

// All /users endpoints are SUPER_ADMIN_KONI only (specs/001-auth-rbac/spec.md §3, §5).
usersRouter.use(authenticate, requireRole(["SUPER_ADMIN_KONI"]));

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const users = await prisma.user.findMany({
      where: parsed.data.role ? { role: parsed.data.role } : undefined,
      orderBy: { createdAt: "asc" },
    });
    res.json(users.map(toSafeUser));
  }),
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { role, cabangOlahragaId, athleteId, ...rest } = parsed.data;
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await prisma.user.create({
        data: {
          ...rest,
          role,
          passwordHash,
          cabangOlahragaId: role === "ADMIN_CABOR" ? cabangOlahragaId : null,
          athleteId: role === "ATLET" ? athleteId : null,
        },
      });

      // Send welcome email with credentials — fire-and-forget (don't block response)
      sendWelcomeEmail({ to: user.email, fullName: user.fullName, password })
        .then(() => console.log(`[email] welcome sent → ${user.email}`))
        .catch((err) => console.error(`[email] welcome FAILED → ${user.email}:`, err?.message ?? err));

      res.status(201).json(toSafeUser(user));
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Email or athleteId already in use" });
        return;
      }
      throw err;
    }
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(toSafeUser(user));
  }),
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { password, ...rest } = parsed.data;

    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
      });
      res.json(toSafeUser(user));
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
      throw err;
    }
  }),
);

// Dedicated endpoint since changing role also changes scoping fields
// (cabangOlahragaId / athleteId) — see specs/001-auth-rbac/spec.md §3.
usersRouter.patch(
  "/:id/role",
  asyncHandler(async (req, res) => {
    const parsed = updateUserRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { role, cabangOlahragaId, athleteId } = parsed.data;

    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          role,
          cabangOlahragaId: role === "ADMIN_CABOR" ? cabangOlahragaId ?? null : null,
          athleteId: role === "ATLET" ? athleteId ?? null : null,
        },
      });
      res.json(toSafeUser(user));
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "athleteId already in use" });
        return;
      }
      throw err;
    }
  }),
);

// Soft delete — deactivates the account (user can no longer log in).
usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) {
      res.status(400).json({ error: "Tidak dapat menonaktifkan akun Anda sendiri" });
      return;
    }
    try {
      await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
      res.status(204).send();
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);

// Hard delete — permanently removes the user record.
usersRouter.delete(
  "/:id/permanent",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) {
      res.status(400).json({ error: "Tidak dapat menghapus akun Anda sendiri" });
      return;
    }
    try {
      await prisma.user.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      // User authored audit logs / monitoring events / articles (Restrict FKs).
      if (isForeignKeyConstraintError(err)) {
        res.status(409).json({
          error:
            "Tidak dapat menghapus permanen: pengguna memiliki data terkait (log, monitoring, atau artikel). Nonaktifkan saja.",
        });
        return;
      }
      throw err;
    }
  }),
);

// Reset password — generate a new random password, update the hash, email credentials.
usersRouter.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const newPassword = generatePassword();
      await prisma.user.update({
        where: { id: req.params.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 10),
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });

      sendPasswordResetByAdminEmail({ to: user.email, fullName: user.fullName, password: newPassword })
        .then(() => console.log(`[email] admin-reset sent → ${user.email}`))
        .catch((err) => console.error(`[email] admin-reset FAILED → ${user.email}:`, err?.message ?? err));

      res.status(204).send();
    } catch (err) {
      if (isNotFoundError(err)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  }),
);
