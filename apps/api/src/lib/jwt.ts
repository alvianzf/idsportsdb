import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@inasportdb/shared-types";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  cabangOlahragaId: string | null;
  athleteId: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload & jwt.JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload & jwt.JwtPayload;
}
