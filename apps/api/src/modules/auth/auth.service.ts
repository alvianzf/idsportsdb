import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { toSafeUser, type SafeUser } from "../users/users.service.js";

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}

function issueTokens(user: User): AuthResult {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    cabangOlahragaId: user.cabangOlahragaId,
    athleteId: user.athleteId,
  });
  const refreshToken = signRefreshToken({ sub: user.id });
  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function login(email: string, password: string): Promise<AuthResult | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return null;

  return issueTokens(user);
}

export async function refresh(refreshToken: string): Promise<AuthResult | null> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;

  return issueTokens(user);
}
