import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  cardVerifyBaseUrl: process.env.CARD_VERIFY_BASE_URL ?? "http://localhost:5173/verify",
  clientUrl,
  appBaseUrl,
  // Explicit CORS/Socket.IO allowlist derived from env; deduped so a single
  // shared value doesn't produce duplicate entries.
  corsOrigins: [...new Set([clientUrl, appBaseUrl])],
  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.sumopod.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "no-reply@batam.koni.go.id",
  },
};
