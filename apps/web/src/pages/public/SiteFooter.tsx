import { Link } from "react-router-dom";
import { Mail, MapPin } from "lucide-react";
import { PUBLIC_NAV } from "./publicNav";

/**
 * Shared public footer. Three columns on desktop — brand, site links, contact —
 * collapsing to a single stack on mobile, with the copyright on its own bottom
 * rule. Links come from PUBLIC_NAV, the same source as the header nav, so the
 * two cannot drift apart.
 *
 * `containerClass` mirrors SiteHeader so the footer lines up with each page's
 * own content column.
 */
export function SiteFooter({ containerClass = "max-w-6xl" }: { containerClass?: string }) {
  return (
    <footer className="bg-neutral-950 text-neutral-400">
      <div className="h-1 w-full bg-gradient-to-r from-[#5c0000] via-[#990000] to-[#d92626]" />

      <div className={`mx-auto ${containerClass} px-4 py-10 md:px-6 md:py-12`}>
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-5">
            <div className="flex items-start gap-3">
              <img src="/logo-koni-batam.png" alt="" className="h-14 w-14 shrink-0 object-contain" />
              <div>
                <p className="text-base font-bold leading-tight text-white">KONI Kota Batam</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Komite Olahraga Nasional Indonesia
                  <br />
                  Kota Batam, Kepulauan Riau
                </p>
              </div>
            </div>
          </div>

          {/* Site links */}
          <nav className="md:col-span-3" aria-label="Tautan situs">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Tautan</p>
            <ul className="mt-3 space-y-2 text-sm">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/login" className="transition-colors hover:text-white">
                  Masuk
                </Link>
              </li>
            </ul>
          </nav>

          {/* Contact */}
          <div className="md:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-200">Kontak</p>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-neutral-500" />
                <span className="text-xs leading-relaxed">
                  Kompleks Ruko KBC (King Business Center) Blok A5 No. 1, Kel. Belian, Kec. Batam
                  Kota, Kota Batam, Kepulauan Riau
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={16} className="shrink-0 text-neutral-500" />
                <a
                  href="mailto:konikotabatam2024@gmail.com"
                  className="text-xs font-medium text-neutral-300 transition-colors hover:text-white"
                >
                  konikotabatam2024@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="text-xs">© {new Date().getFullYear()} KONI Kota Batam</p>
        </div>
      </div>
    </footer>
  );
}
