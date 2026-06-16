import type { User } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

/** Strips `passwordHash` before sending a user record to the client. */
export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
