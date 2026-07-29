import { Prisma } from "@prisma/client";

export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

export function isForeignKeyConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

/**
 * The database is unreachable rather than the request being bad — P1001 (can't
 * reach the server), P1002 (timed out), P1017 (connection closed), or a client
 * that never managed to connect at all.
 */
export function isConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1001", "P1002", "P1017"].includes(err.code)
  );
}
