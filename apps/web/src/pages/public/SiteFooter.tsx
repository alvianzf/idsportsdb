import { Link } from "react-router-dom";
import { PUBLIC_NAV } from "./publicNav";

/**
 * Shared public footer. Extracted from LandingPage so every public page gets
 * the same footer; the site links come from PUBLIC_NAV, the same source as the
 * header nav, so the two cannot drift apart.
 */
export function SiteFooter() {
  return (
    <footer className="bg-neutral-950">
      <div className="h-1 w-full bg-gradient-to-r from-[#5c0000] via-[#990000] to-[#d92626]" />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="flex flex-col gap-6 text-xs text-neutral-400 md:flex-row md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <img src="/logo-koni-batam.png" alt="" className="h-16 w-16 object-contain" />
              <p className="text-sm font-bold text-white">KONI Kota Batam</p>
            </div>
          </div>

          <nav aria-label="Tautan situs">
            <p className="font-semibold text-neutral-200">Tautan</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1.5">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/login" className="hover:text-white">
                  Masuk
                </Link>
              </li>
            </ul>
          </nav>

        </div>

        {/* Bottom bar — address, contact and copyright. */}
        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 text-xs leading-relaxed text-neutral-400 md:flex-row md:items-end md:justify-between">
          <p className="max-w-md">
            Kompleks Ruko KBC (King Business Center) Blok A5 No. 1, Kel. Belian, Kec. Batam Kota,
            Kota Batam, Kepulauan Riau
          </p>
          <div className="md:text-right">
            <a href="mailto:konikotabatam2024@gmail.com" className="font-medium text-neutral-300 hover:text-white">
              konikotabatam2024@gmail.com
            </a>
            <p className="mt-1">© {new Date().getFullYear()} KONI Kota Batam</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
