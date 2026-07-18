import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Role } from "@inasportdb/shared-types";
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

// User-management RBAC (follow-up #68). SUPER_ADMIN_KONI is unrestricted;
// ADMIN_KONI may fully manage ADMIN_CABOR/ATLET accounts but must never create,
// promote to, or act on SUPER_ADMIN_KONI or ADMIN_KONI accounts.
const PRIVILEGED_ROLES: Role[] = ["SUPER_ADMIN_KONI", "ADMIN_KONI"];

/** Whether `actorRole` is allowed to assign `newRole` to a user. */
function canAssignRole(actorRole: Role, newRole: Role): boolean {
  if (actorRole === "SUPER_ADMIN_KONI") return true;
  if (actorRole === "ADMIN_KONI") return !PRIVILEGED_ROLES.includes(newRole);
  return false;
}

/** Whether `actorRole` may mutate a target account whose role is `targetRole`. */
function canManageTarget(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "SUPER_ADMIN_KONI") return true;
  if (actorRole === "ADMIN_KONI") return !PRIVILEGED_ROLES.includes(targetRole);
  return false;
}

/**
 * Loads the target user and enforces `canManageTarget` for the acting user.
 * On success returns the target's current role; on failure it has already sent
 * a 404 (missing) or 403 (privileged target) response and returns null.
 */
async function loadManageableTarget(req: Request, res: Response): Promise<Role | null> {
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { role: true },
  });
  if (!target) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (!canManageTarget(req.user!.role, target.role)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return target.role;
}
import {
  createUserSchema,
  updateUserRoleSchema,
  updateUserSchema,
} from "../auth/auth.schema.js";
import { listUsersQuerySchema } from "./users.schema.js";
import { toSafeUser } from "./users.service.js";
import { writeAudit } from "../../lib/audit.js";

export const usersRouter = Router();

usersRouter.use(authenticate);

// Provisioning logins is broadened for #68: ADMIN_KONI may create any non-super
// account, and ADMIN_CABOR may create ATLET logins for athletes in their own
// cabor. Registered before the SUPER-only guard so the broader roles reach it.
usersRouter.post(
  "/",
  requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI", "ADMIN_CABOR"]),
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    // Password is auto-generated on the server; ignore any client-sent value (see auth.schema.ts).
    const { role, cabangOlahragaId, athleteId, password: _ignored, ...rest } = parsed.data;
    const creator = req.user!;

    // Role-escalation guard: SUPER may assign any role; ADMIN_KONI may not mint
    // SUPER_ADMIN_KONI or ADMIN_KONI accounts (canAssignRole). ADMIN_CABOR is
    // further restricted to ATLET by the block below, so skip it here.
    if (creator.role !== "ADMIN_CABOR" && !canAssignRole(creator.role, role)) {
      res.status(403).json({
        error:
          creator.role === "ADMIN_KONI"
            ? "Admin KONI hanya dapat membuat akun Admin Cabor atau Atlet"
            : "Hanya Super Admin yang dapat membuat akun Super Admin",
      });
      return;
    }

    // ADMIN_CABOR is limited to ATLET logins for athletes in their own cabor.
    if (creator.role === "ADMIN_CABOR") {
      if (role !== "ATLET") {
        res.status(403).json({ error: "Admin Cabor hanya dapat membuat akun atlet" });
        return;
      }
      if (!creator.cabangOlahragaId) {
        res.status(403).json({ error: "Akun admin cabor tidak terhubung ke cabang olahraga" });
        return;
      }
      // #70 — don't provision a login for a soft-deleted (archived) athlete.
      const atlet = await prisma.atlet.findFirst({
        where: { id: athleteId!, deletedAt: null },
        select: { cabangOlahragaId: true },
      });
      if (!atlet) {
        res.status(400).json({ error: "athleteId does not exist" });
        return;
      }
      if (atlet.cabangOlahragaId !== creator.cabangOlahragaId) {
        res.status(403).json({ error: "Atlet tersebut bukan bagian dari cabang olahraga Anda" });
        return;
      }
    }

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
      writeAudit(req.user!.id, "CREATE", "User", user.id);

      // Await the welcome email so we can report delivery status. The generated
      // password is returned once regardless, so a SMTP misfire never strands
      // the account (#68) — the admin can hand the password over manually.
      let emailSent = false;
      try {
        await sendWelcomeEmail({ to: user.email, fullName: user.fullName, password });
        emailSent = true;
        console.log(`[email] welcome sent → ${user.email}`);
      } catch (err) {
        console.error(`[email] welcome FAILED → ${user.email}:`, (err as Error)?.message ?? err);
      }

      res.status(201).json({ ...toSafeUser(user), generatedPassword: password, emailSent });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        res.status(409).json({ error: "Email or athleteId already in use" });
        return;
      }
      if (isForeignKeyConstraintError(err)) {
        res.status(400).json({ error: "cabangOlahragaId or athleteId does not exist" });
        return;
      }
      throw err;
    }
  }),
);

// Remaining /users endpoints are open to SUPER_ADMIN_KONI and ADMIN_KONI.
// ADMIN_KONI's per-target limits (no acting on SUPER/ADMIN_KONI accounts) are
// enforced in each mutating handler via loadManageableTarget/canAssignRole
// (follow-up #68); GET list/view stays available to both.
usersRouter.use(requireRole(["SUPER_ADMIN_KONI", "ADMIN_KONI"]));

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
      // Revisi 2026-07-18: the list shows each account's cabor.
      include: { cabangOlahraga: { select: { id: true, nama: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(users.map((u) => ({ ...toSafeUser(u), cabangOlahraga: u.cabangOlahraga })));
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

    if ((await loadManageableTarget(req, res)) === null) return;

    const { password, ...rest } = parsed.data;

    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
      });
      writeAudit(req.user!.id, "UPDATE", "User", user.id);
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

    // Guard the current target account, then the role being assigned.
    if ((await loadManageableTarget(req, res)) === null) return;
    if (!canAssignRole(req.user!.role, role)) {
      res.status(403).json({
        error: "Admin KONI tidak dapat menetapkan peran Super Admin atau Admin KONI",
      });
      return;
    }

    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          role,
          cabangOlahragaId: role === "ADMIN_CABOR" ? cabangOlahragaId ?? null : null,
          athleteId: role === "ATLET" ? athleteId ?? null : null,
        },
      });
      writeAudit(req.user!.id, "UPDATE_ROLE", "User", user.id);
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
      if (isForeignKeyConstraintError(err)) {
        res.status(400).json({ error: "cabangOlahragaId or athleteId does not exist" });
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
    if ((await loadManageableTarget(req, res)) === null) return;
    try {
      await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
      writeAudit(req.user!.id, "DEACTIVATE", "User", req.params.id);
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
    if ((await loadManageableTarget(req, res)) === null) return;
    try {
      await prisma.user.delete({ where: { id: req.params.id } });
      writeAudit(req.user!.id, "DELETE", "User", req.params.id);
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
      if (!canManageTarget(req.user!.role, user.role)) {
        res.status(403).json({ error: "Forbidden" });
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
      writeAudit(req.user!.id, "RESET_PASSWORD", "User", req.params.id);

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
