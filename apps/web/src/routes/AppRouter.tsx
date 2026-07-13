import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { RequireRole } from "../components/RequireRole";
import { ADMIN_ROLES } from "../layouts/navConfig";

// Helper so named-export pages work with React.lazy (which needs a default export).
// A failed chunk fetch usually means a new deploy replaced the hashed assets while
// this tab still holds the old index.html — reload once to pick up the new build.
function page<T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T,
): React.LazyExoticComponent<React.ComponentType> {
  // Key the reload flag per-chunk so a permanently-404 chunk can't loop: a
  // successful load only clears its own flag, leaving a genuinely broken chunk's
  // flag set after its one retry.
  const flag = `chunk-reload:${String(name)}`;
  return lazy(() =>
    loader().then(
      (m) => {
        sessionStorage.removeItem(flag);
        return { default: m[name] as React.ComponentType };
      },
      (err) => {
        if (!sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, "1");
          window.location.reload();
          return new Promise<never>(() => undefined); // reloading — never resolve
        }
        throw err; // second failure: real problem, surface it
      },
    ),
  );
}

// Public / shell (kept eager — tiny, needed immediately)
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";

// Lazy pages — each becomes its own JS chunk
const DashboardPage = page(() => import("../pages/DashboardPage"), "DashboardPage");

const CaborListPage = page(() => import("../pages/cabor/CaborListPage"), "CaborListPage");
const CaborDetailPage = page(() => import("../pages/cabor/CaborDetailPage"), "CaborDetailPage");
const CaborFormPage = page(() => import("../pages/cabor/CaborFormPage"), "CaborFormPage");

const AtletListPage = page(() => import("../pages/atlet/AtletListPage"), "AtletListPage");
const AtletDetailPage = page(() => import("../pages/atlet/AtletDetailPage"), "AtletDetailPage");
const AtletFormPage = page(() => import("../pages/atlet/AtletFormPage"), "AtletFormPage");
const AtletRecordPage = page(() => import("../pages/atlet/AtletRecordPage"), "AtletRecordPage");
const MePage = page(() => import("../pages/atlet/MePage"), "MePage");

const PelatihListPage = page(() => import("../pages/pelatih/PelatihListPage"), "PelatihListPage");
const PelatihDetailPage = page(() => import("../pages/pelatih/PelatihDetailPage"), "PelatihDetailPage");
const PelatihFormPage = page(() => import("../pages/pelatih/PelatihFormPage"), "PelatihFormPage");

const PrestasiListPage = page(() => import("../pages/prestasi/PrestasiListPage"), "PrestasiListPage");
const MonitoringPage = page(() => import("../pages/monitoring/MonitoringPage"), "MonitoringPage");

// Revisi 2026-07-12 — event calendar (admin + public) and public data/berita menus
const EventListPage = page(() => import("../pages/event/EventListPage"), "EventListPage");
const EventPublicPage = page(() => import("../pages/public/EventPublicPage"), "EventPublicPage");
const DataPublicPage = page(() => import("../pages/public/DataPublicPage"), "DataPublicPage");
const BeritaPage = page(() => import("../pages/public/BeritaPage"), "BeritaPage");

const ReportsIndexPage = page(() => import("../pages/reports/ReportsIndexPage"), "ReportsIndexPage");
const AtletPerCaborReportPage = page(() => import("../pages/reports/AtletPerCaborReportPage"), "AtletPerCaborReportPage");
const AtletPerUsiaReportPage = page(() => import("../pages/reports/AtletPerUsiaReportPage"), "AtletPerUsiaReportPage");
const AtletPerKecamatanReportPage = page(() => import("../pages/reports/AtletPerKecamatanReportPage"), "AtletPerKecamatanReportPage");
const PelatihReportPage = page(() => import("../pages/reports/PelatihReportPage"), "PelatihReportPage");
const PrestasiReportPage = page(() => import("../pages/reports/PrestasiReportPage"), "PrestasiReportPage");
const RekapMedaliReportPage = page(() => import("../pages/reports/RekapMedaliReportPage"), "RekapMedaliReportPage");

const ArtikelListPage = page(() => import("../pages/artikel/ArtikelListPage"), "ArtikelListPage");
const ArtikelFormPage = page(() => import("../pages/artikel/ArtikelFormPage"), "ArtikelFormPage");
const ArtikelPublicPage = page(() => import("../pages/artikel/ArtikelPublicPage"), "ArtikelPublicPage");

const SliderAdminPage = page(() => import("../pages/slider/SliderAdminPage"), "SliderAdminPage");
const UsersListPage = page(() => import("../pages/users/UsersListPage"), "UsersListPage");
const UsersFormPage = page(() => import("../pages/users/UsersFormPage"), "UsersFormPage");
const AuditLogPage = page(() => import("../pages/audit/AuditLogPage"), "AuditLogPage");

function PageLoader() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-primary" />
      <p className="animate-pulse text-sm text-neutral-400">Memuat...</p>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  // Public menus (revisi 2026-07-12) — no auth required
  {
    path: "/event",
    element: (
      <Suspense fallback={<PageLoader />}>
        <EventPublicPage />
      </Suspense>
    ),
  },
  {
    path: "/data",
    element: (
      <Suspense fallback={<PageLoader />}>
        <DataPublicPage />
      </Suspense>
    ),
  },
  {
    path: "/berita",
    element: (
      <Suspense fallback={<PageLoader />}>
        <BeritaPage />
      </Suspense>
    ),
  },
  {
    path: "/atlet/:id/rekam",
    element: (
      <Suspense fallback={<PageLoader />}>
        <AtletRecordPage />
      </Suspense>
    ),
  },
  {
    path: "/artikel/:slug",
    element: (
      <Suspense fallback={<PageLoader />}>
        <ArtikelPublicPage />
      </Suspense>
    ),
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <AppLayout />,
    children: [
      // Module A
      { path: "dashboard", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><DashboardPage /></Suspense></RequireRole> },

      // Module E
      { path: "cabor", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><CaborListPage /></Suspense></RequireRole> },
      { path: "cabor/new", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><CaborFormPage /></Suspense></RequireRole> },
      { path: "cabor/:id", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><CaborDetailPage /></Suspense></RequireRole> },
      { path: "cabor/:id/edit", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><CaborFormPage /></Suspense></RequireRole> },

      // Module B
      { path: "atlet", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><AtletListPage /></Suspense></RequireRole> },
      { path: "atlet/new", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><AtletFormPage /></Suspense></RequireRole> },
      { path: "atlet/:id", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><AtletDetailPage /></Suspense></RequireRole> },
      { path: "atlet/:id/edit", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><AtletFormPage /></Suspense></RequireRole> },

      // Module C
      { path: "pelatih", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><PelatihListPage /></Suspense></RequireRole> },
      { path: "pelatih/new", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><PelatihFormPage /></Suspense></RequireRole> },
      { path: "pelatih/:id", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><PelatihDetailPage /></Suspense></RequireRole> },
      { path: "pelatih/:id/edit", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><PelatihFormPage /></Suspense></RequireRole> },

      // Module F
      { path: "prestasi", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><PrestasiListPage /></Suspense></RequireRole> },

      // Module G
      { path: "monitoring", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><MonitoringPage /></Suspense></RequireRole> },

      // Kalender Event (spec 017)
      { path: "events", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><EventListPage /></Suspense></RequireRole> },

      // Module H
      { path: "reports", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><ReportsIndexPage /></Suspense></RequireRole> },
      { path: "reports/atlet-per-cabor", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><AtletPerCaborReportPage /></Suspense></RequireRole> },
      { path: "reports/atlet-per-usia", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><AtletPerUsiaReportPage /></Suspense></RequireRole> },
      { path: "reports/atlet-per-kecamatan", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><AtletPerKecamatanReportPage /></Suspense></RequireRole> },
      { path: "reports/pelatih", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><PelatihReportPage /></Suspense></RequireRole> },
      { path: "reports/prestasi", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><PrestasiReportPage /></Suspense></RequireRole> },
      { path: "reports/rekap-medali", element: <RequireRole roles={ADMIN_ROLES}><Suspense fallback={<PageLoader />}><RekapMedaliReportPage /></Suspense></RequireRole> },

      // Article CMS
      {
        path: "artikel",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI", "ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><ArtikelListPage /></Suspense>
          </RequireRole>
        ),
      },
      {
        path: "artikel/new",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI", "ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><ArtikelFormPage /></Suspense>
          </RequireRole>
        ),
      },
      {
        path: "artikel/:id/edit",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI", "ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><ArtikelFormPage /></Suspense>
          </RequireRole>
        ),
      },

      // Slider beranda (Super Admin only, spec 019)
      {
        path: "slider",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><SliderAdminPage /></Suspense>
          </RequireRole>
        ),
      },

      // Users (Super Admin only)
      {
        path: "users",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><UsersListPage /></Suspense>
          </RequireRole>
        ),
      },
      {
        path: "users/new",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><UsersFormPage /></Suspense>
          </RequireRole>
        ),
      },
      {
        path: "users/:id/edit",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><UsersFormPage /></Suspense>
          </RequireRole>
        ),
      },

      // Audit trail (Super Admin only, issue #69)
      {
        path: "audit",
        element: (
          <RequireRole roles={["SUPER_ADMIN_KONI"]}>
            <Suspense fallback={<PageLoader />}><AuditLogPage /></Suspense>
          </RequireRole>
        ),
      },

      { path: "settings/profile", element: <Navigate to="/dashboard" replace /> },

      // Atlet self-service
      { path: "me", element: <Suspense fallback={<PageLoader />}><MePage /></Suspense> },
      { path: "me/prestasi", element: <Suspense fallback={<PageLoader />}><MePage /></Suspense> },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
