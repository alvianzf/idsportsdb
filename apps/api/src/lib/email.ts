import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: { user: env.smtp.user, pass: env.smtp.pass },
});

async function send(to: string, subject: string, html: string) {
  await transporter.sendMail({ from: `"KONI Batam" <${env.smtp.from}>`, to, subject, html });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  fullName: string;
  password: string;
}) {
  await send(
    opts.to,
    "Selamat datang di Sistem KONI Batam — Akun Anda telah dibuat",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <img src="https://batam.koni.go.id/logo-koni-batam.png" alt="KONI Batam" style="height:56px;margin-bottom:16px" />
      <h2 style="color:#c8102e;margin:0 0 8px">Halo, ${opts.fullName}!</h2>
      <p style="color:#374151">Akun Anda di Sistem Informasi Manajemen Atlet KONI Batam telah dibuat. Berikut adalah kredensial masuk Anda:</p>
      <table style="background:#f9fafb;border-radius:8px;padding:16px;width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="color:#6b7280;padding:4px 0;width:120px">Email</td><td style="color:#111827;font-weight:600">${opts.to}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Kata Sandi</td><td style="color:#111827;font-weight:600;font-family:monospace">${opts.password}</td></tr>
      </table>
      <p style="color:#374151">Silakan masuk di <a href="${env.appBaseUrl}/login" style="color:#c8102e">${env.appBaseUrl}/login</a> dan segera ganti kata sandi Anda setelah masuk pertama kali.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Email ini dikirim secara otomatis. Jangan balas email ini.</p>
    </div>
    `,
  );
}

export async function sendPasswordResetByAdminEmail(opts: {
  to: string;
  fullName: string;
  password: string;
}) {
  await send(
    opts.to,
    "Kata sandi Anda telah direset — KONI Batam",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <img src="https://batam.koni.go.id/logo-koni-batam.png" alt="KONI Batam" style="height:56px;margin-bottom:16px" />
      <h2 style="color:#c8102e;margin:0 0 8px">Reset Kata Sandi</h2>
      <p style="color:#374151">Halo, ${opts.fullName}. Kata sandi akun Anda telah direset oleh administrator. Berikut adalah kredensial masuk baru Anda:</p>
      <table style="background:#f9fafb;border-radius:8px;padding:16px;width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="color:#6b7280;padding:4px 0;width:120px">Email</td><td style="color:#111827;font-weight:600">${opts.to}</td></tr>
        <tr><td style="color:#6b7280;padding:4px 0">Kata Sandi Baru</td><td style="color:#111827;font-weight:600;font-family:monospace">${opts.password}</td></tr>
      </table>
      <p style="color:#374151">Silakan masuk di <a href="${env.appBaseUrl}/login" style="color:#c8102e">${env.appBaseUrl}/login</a> dan segera ganti kata sandi Anda.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Email ini dikirim secara otomatis. Jangan balas email ini.</p>
    </div>
    `,
  );
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  fullName: string;
  resetToken: string;
}) {
  const link = `${env.appBaseUrl}/reset-password?token=${opts.resetToken}`;
  await send(
    opts.to,
    "Reset Kata Sandi — KONI Batam",
    `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <img src="https://batam.koni.go.id/logo-koni-batam.png" alt="KONI Batam" style="height:56px;margin-bottom:16px" />
      <h2 style="color:#c8102e;margin:0 0 8px">Reset Kata Sandi</h2>
      <p style="color:#374151">Halo, ${opts.fullName}. Kami menerima permintaan untuk mereset kata sandi akun Anda.</p>
      <a href="${link}" style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin:16px 0">Reset Kata Sandi</a>
      <p style="color:#6b7280;font-size:13px">Atau salin tautan berikut ke browser Anda:<br/><span style="color:#374151;font-family:monospace;word-break:break-all">${link}</span></p>
      <p style="color:#6b7280;font-size:13px">Tautan ini akan kedaluwarsa dalam <strong>1 jam</strong>. Jika Anda tidak meminta reset kata sandi, abaikan email ini.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Email ini dikirim secara otomatis. Jangan balas email ini.</p>
    </div>
    `,
  );
}
