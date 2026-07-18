import { useLocation, useNavigate } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button } from "../components/ui";
import { AppLayout } from "../layouts/AppLayout";
import { useAuthStore } from "../store/authStore";

// Paths that belong to the authenticated admin area (dashboard layout).
const ADMIN_PREFIXES = [
  "/dashboard",
  "/atlet",
  "/cabor",
  "/pelatih",
  "/prestasi",
  "/monitoring",
  "/events",
  "/reports",
  "/slider",
  "/users",
  "/audit",
  "/me",
  "/settings",
];

// Revisi 2026-07-18: the 404 CTA returns to the previous page; the fallback
// (direct link / new tab, no history) goes to the given home path.
function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback);
  };
}

/** 404 rendered inside the admin layout (retains sidebar + topbar). */
function DashboardNotFound() {
  const goBack = useGoBack("/dashboard");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <FileQuestion size={32} />
      </div>
      <p className="text-4xl font-bold text-primary">404</p>
      <h1 className="text-lg font-semibold text-neutral-900">Halaman tidak ditemukan</h1>
      <p className="text-sm text-neutral-500">Halaman yang Anda cari tidak tersedia.</p>
      <Button onClick={goBack}>Kembali ke Halaman Sebelumnya</Button>
    </div>
  );
}

/** 404 for the public / landing side — unauthenticated look with the KONI logo. */
export function PublicNotFound() {
  const goBack = useGoBack("/");
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-neutral-50 p-4 text-center">
      <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-20 w-20 object-contain" />
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="text-lg font-semibold text-neutral-900">Halaman tidak ditemukan</h1>
      <p className="text-sm text-neutral-500">Halaman yang Anda cari tidak tersedia.</p>
      <Button onClick={goBack}>Kembali ke Halaman Sebelumnya</Button>
    </div>
  );
}

/**
 * Route-level 404 decider. A logged-in user on an admin-area path gets the
 * dashboard 404 inside the admin layout; everyone else — public paths, or a
 * logged-out visitor — gets the public 404 with the KONI logo (even when the
 * user is authenticated but landed on the public side).
 */
export function NotFoundPage() {
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();
  const isAdminContext = ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (user && isAdminContext) {
    return (
      <AppLayout>
        <DashboardNotFound />
      </AppLayout>
    );
  }
  return <PublicNotFound />;
}
