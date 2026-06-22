import { createServer } from "node:http";
import path from "node:path";
import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { env } from "./config/env.js";
import { initSocket } from "./lib/socket.js";
import { uploadRoot } from "./lib/storage.js";
import { authenticate } from "./middleware/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { caborRouter } from "./modules/cabor/cabor.routes.js";
import { caborPengurusRouter, pengurusRouter } from "./modules/pengurus/pengurus.routes.js";
import { atletRouter } from "./modules/atlet/atlet.routes.js";
import { pelatihRouter } from "./modules/pelatih/pelatih.routes.js";
import { prestasiRouter, atletPrestasiRouter } from "./modules/prestasi/prestasi.routes.js";
import { monitoringRouter, atletMonitoringRouter } from "./modules/monitoring/monitoring.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { cardsRouter, atletCardRouter } from "./modules/cards/cards.routes.js";
import { artikelRouter } from "./modules/artikel/artikel.routes.js";
import { publicRouter } from "./modules/public/public.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL ?? true, credentials: true }));
app.use(express.json());

// Sensitive atlet documents require authentication.
app.use("/uploads/atlet-documents", authenticate, (req, res) => {
  const filename = req.path.replace(/^\//, "");
  res.sendFile(path.join(uploadRoot, "atlet-documents", filename));
});

// All other uploads (article images, certificates, etc.) are public.
app.use("/uploads", express.static(uploadRoot, { maxAge: "7d", immutable: false }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/public", publicRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/cabor", caborRouter);
app.use("/api/v1/cabor", caborPengurusRouter);
app.use("/api/v1/atlet", atletRouter);
app.use("/api/v1/atlet", atletPrestasiRouter);
app.use("/api/v1/atlet", atletMonitoringRouter);
app.use("/api/v1/atlet", atletCardRouter);
app.use("/api/v1/pelatih", pelatihRouter);
app.use("/api/v1/prestasi", prestasiRouter);
app.use("/api/v1/monitoring", monitoringRouter);
app.use("/api/v1/pengurus", pengurusRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/cards", cardsRouter);
app.use("/api/v1/artikel", artikelRouter);

app.use("/api/v1", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`KONI Batam API listening on http://localhost:${env.port}`);
  // Pre-warm the DB connection pool so the first dashboard request isn't slow.
  prisma.$queryRaw`SELECT 1`.catch(() => undefined);
});
