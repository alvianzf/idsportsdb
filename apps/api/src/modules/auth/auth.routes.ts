import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { loginSchema, refreshSchema, updateUserSchema } from "./auth.schema.js";
import * as authService from "./auth.service.js";
import { toSafeUser } from "../users/users.service.js";

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
