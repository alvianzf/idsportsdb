import { useEffect, type ReactNode } from "react";
import { PublicBottomNav } from "./PublicBottomNav";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { pageTitle } from "../../lib/site";

/** Shared header/footer shell for public (no-auth) pages. Revisi 2026-07-12. */
export function PublicShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);

  return (
    <div className="flex min-h-svh flex-col bg-neutral-50 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <SiteHeader containerClass="max-w-5xl" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold text-neutral-900 md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        <div className="mt-6">{children}</div>
      </main>

      <SiteFooter />
      <PublicBottomNav />
    </div>
  );
}
