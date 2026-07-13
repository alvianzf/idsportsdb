import type { User } from "@prisma/client";

export type SafeUser = Omit<
  User,
  "passwordHash" | "passwordResetToken" | "passwordResetExpiry"
>;

/** Strips secrets (`passwordHash`, password-reset token/expiry) before sending a user record to the client. */
export function toSafeUser(user: User): SafeUser {
  const {
    passwordHash: _passwordHash,
    passwordResetToken: _passwordResetToken,
    passwordResetExpiry: _passwordResetExpiry,
    ...rest
  } = user;
  return rest;
}
