import type { Request } from "express";
import type { Prisma } from "@prisma/client";

/** Prisma `where` fragment matching athletes whose primary OR additional cabor is `caborId`. */
export function atletInCaborFilter(caborId: string): Prisma.AtletWhereInput {
  return {
    OR: [{ cabangOlahragaId: caborId }, { caborTambahan: { some: { cabangOlahragaId: caborId } } }],
  };
}

interface AtletWithCabor {
  cabangOlahragaId: string;
  caborTambahan?: { cabangOlahragaId: string }[];
}

/** True if the athlete's primary or additional cabor matches `caborId`. */
export function isAtletInCabor(atlet: AtletWithCabor, caborId: string): boolean {
  return (
    atlet.cabangOlahragaId === caborId ||
    (atlet.caborTambahan?.some((c) => c.cabangOlahragaId === caborId) ?? false)
  );
}

/** Standard `include` fragment for surfacing additional cabor memberships. */
export const caborTambahanInclude = {
  caborTambahan: { include: { cabangOlahraga: { select: { id: true, nama: true } } } },
} as const;

/**
 * specs/004-atlet/spec.md §5 — whether `req.user` can view/edit data belonging
 * to `atlet`: SUPER_ADMIN/ADMIN_KONI unrestricted; ADMIN_CABOR if the athlete's
 * primary or additional cabor matches `req.scopedCaborId`; ATLET only self.
 */
export function canAccessAtlet(req: Request, atlet: AtletWithCabor & { id: string }): boolean {
  if (req.user!.role === "ATLET") {
    return atlet.id === req.user!.athleteId;
  }
  if (req.scopedCaborId) {
    return isAtletInCabor(atlet, req.scopedCaborId);
  }
  return true;
}
