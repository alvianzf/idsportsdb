import type { Request, Response, NextFunction } from "express";
import type { Role } from "@inasportdb/shared-types";
import { DATA_ADMIN_ROLES } from "@inasportdb/shared-types";
import { verifyAccessToken } from "../lib/jwt.js";

export interface RequestUser {
  id: string;
  role: Role;
  cabangOlahragaId: string | null;
  athleteId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
      /** Set by `scopeToCabor`: the cabor an ADMIN_CABOR user is restricted to, else null. */
      scopedCaborId?: string | null;
    }
  }
}

/** Verifies the access token and attaches `req.user`. */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing access token" });
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.user = {
      id: payload.sub,
      role: payload.role,
      cabangOlahragaId: payload.cabangOlahragaId,
      athleteId: payload.athleteId,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}

/** 403 unless `req.user.role` is one of `roles`. Must run after `authenticate`. */
export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * For ADMIN_CABOR, sets `req.scopedCaborId` to their own cabor id. Route
 * handlers must filter list queries by this and reject (403) writes that
 * target a different cabor. Must run after `authenticate`.
 */
export function scopeToCabor(req: Request, _res: Response, next: NextFunction) {
  req.scopedCaborId = req.user?.role === "ADMIN_CABOR" ? req.user.cabangOlahragaId : null;
  next();
}

/**
 * Allows `DATA_ADMIN_ROLES` unconditionally, or an `ATLET` only when the
 * resource's `atletId` (resolved via `getAtletId`) matches `req.user.athleteId`.
 * Must run after `authenticate`.
 */
export function requireSelfOrAdmin(getAtletId: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (DATA_ADMIN_ROLES.includes(req.user.role)) {
      next();
      return;
    }
    if (req.user.role === "ATLET" && req.user.athleteId === getAtletId(req)) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}
