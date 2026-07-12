import { useCallback, useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  MapPin,
  Medal as MedalIcon,
  Trophy,
  UserCog,
  Users,
} from "lucide-react";
import { EVENT_LEVEL_LABELS, EVENT_STATUS_LABELS } from "@inasportdb/shared-types";
import { Button } from "../components/ui";
import { api, resolveFileUrl } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuthStore } from "../store/authStore";
import { PUBLIC_NAV } from "./public/publicNav";
import { LandingSlider } from "./public/LandingSlider";
import {
  EVENT_STATUS_TEXT,
  formatEventDate,
  type PublicEvent,
} from "./public/eventShared";

interface PublicStats {
  caborCount: number;
  activeAtletCount: number;
  pelatihCount: number;
  medals: { GOLD: number; SILVER: number; BRONZE: number };
}

interface PublicArtikel {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

/** Public landing page — redesigned per client revision 2026-07-12 (bold
 * gradients, sharp colors, framer-motion) with Data/Berita/Event menus. */
export function LandingPage() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [articles, setArticles] = useState<PublicArtikel[]>([]);
  const [events, setEvents] = useState<PublicEvent[]>([]);

  const loadData = useCallback(() => {
    api.get<PublicStats>("/public/stats").then((res) => setStats(res.data)).catch(() => undefined);
    api
      .get<PublicArtikel[]>("/public/artikel", { params: { limit: 6 } })
      .then((res) => setArticles(res.data))
      .catch(() => undefined);
    api
      .get<PublicEvent[]>("/public/events", { params: { limit: 4 } })
      .then((res) => setEvents(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("atlet:change", loadData);
    socket.on("prestasi:change", loadData);
    socket.on("artikel:change", loadData);
    socket.on("event:change", loadData);
    return () => {
      socket.off("atlet:change", loadData);
      socket.off("prestasi:change", loadData);
      socket.off("artikel:change", loadData);
      socket.off("event:change", loadData);
    };
  }, [loadData]);

  const totalMedali = stats ? stats.medals.GOLD + stats.medals.SILVER + stats.medals.BRONZE : null;

  return (
    <div className="min-h-svh bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-bold leading-tight text-neutral-900">KONI Batam</p>
              <p className="text-[11px] leading-tight text-neutral-500">Sistem Informasi Manajemen Atlet</p>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 font-semibold transition-colors ${
                    isActive ? "bg-primary-50 text-primary" : "text-neutral-700 hover:bg-primary-50 hover:text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <Link to={user.role === "ATLET" ? "/me" : "/dashboard"} className="ml-2">
                <Button>Dashboard</Button>
              </Link>
            ) : (
              <Link to="/login" className="ml-2">
                <Button>Masuk</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Full-width slider (superadmin-managed, spec 019) */}
      <LandingSlider />

      {/* Hero — sharp red gradient */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#5c0000] via-[#990000] to-[#d92626]">
        {/* decorative glows */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#ff3b3b]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-[#ffb199]/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-white/85">
              <Trophy size={13} /> Satu Data Olahraga Batam
            </p>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              Komite Olahraga Nasional Indonesia
              <span className="block bg-gradient-to-r from-[#ffd166] via-[#ffb347] to-[#ff8c42] bg-clip-text text-transparent">
                Kota Batam
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
              Data atlet, tenaga olahraga, cabang olahraga, prestasi, dan kalender event KONI Batam —
              transparan dan dapat diakses publik.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/data">
                <Button className="!bg-white !text-[#990000] hover:!bg-neutral-100">
                  Lihat Data & Statistik <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/event">
                <Button className="!border !border-white/40 !bg-white/10 !text-white backdrop-blur hover:!bg-white/20">
                  <CalendarDays size={16} /> Kalender Event
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats band — overlapping cards */}
      <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 md:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
        >
          {[
            { label: "Atlet Aktif", value: stats?.activeAtletCount, icon: Users },
            { label: "Cabang Olahraga", value: stats?.caborCount, icon: Building2 },
            { label: "Pelatih", value: stats?.pelatihCount, icon: UserCog },
            { label: "Total Medali", value: totalMedali, icon: MedalIcon },
          ].map(({ label, value, icon: Icon }) => (
            <motion.div
              key={label}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-lg shadow-neutral-900/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#990000] to-[#d92626] text-white shadow-md shadow-red-900/30">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold tabular-nums text-neutral-900">{value ?? "—"}</p>
                  <p className="text-xs font-medium text-neutral-500">{label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
        {/* Medali */}
        {stats && (
          <motion.section {...fadeUp} className="mt-10 md:mt-14">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-100 px-5 py-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900">
                  Perolehan Medali
                </h2>
              </div>
              <div className="grid grid-cols-3 divide-x divide-neutral-100">
                {[
                  { label: "Emas", value: stats.medals.GOLD, cls: "from-[#f7b500] to-[#e08700]" },
                  { label: "Perak", value: stats.medals.SILVER, cls: "from-[#9ca3af] to-[#6b7280]" },
                  { label: "Perunggu", value: stats.medals.BRONZE, cls: "from-[#c9793a] to-[#98501c]" },
                ].map((m) => (
                  <div key={m.label} className="px-4 py-6 text-center">
                    <p className={`bg-gradient-to-b ${m.cls} bg-clip-text text-4xl font-extrabold tabular-nums text-transparent`}>
                      {m.value}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Kalender Event preview */}
        {events.length > 0 && (
          <motion.section {...fadeUp} className="mt-10 md:mt-14">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">Kalender Event</h2>
              <Link to="/event" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Lihat semua <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#990000] to-[#d92626]" />
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900">{e.namaKejuaraan}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} /> {formatEventDate(e)}
                        </span>
                        {e.lokasi && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {e.lokasi}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-neutral-500">
                        {EVENT_LEVEL_LABELS[e.tingkat]}
                        {e.cabangOlahraga ? ` · ${e.cabangOlahraga.nama}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${EVENT_STATUS_TEXT[e.status]}`}>
                      {EVENT_STATUS_LABELS[e.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Berita */}
        {articles.length > 0 && (
          <motion.section {...fadeUp} className="mt-10 md:mt-14">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">Berita</h2>
              <Link to="/berita" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Lihat semua <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {articles.map((a) => (
                <Link
                  key={a.id}
                  to={`/artikel/${a.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {a.coverImageUrl ? (
                    <img src={resolveFileUrl(a.coverImageUrl)} alt="" className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[#990000] to-[#d92626]">
                      <img src="/logo-koni-batam.png" alt="" className="h-14 w-14 object-contain opacity-80" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="font-semibold leading-snug text-neutral-900 group-hover:text-primary line-clamp-2">
                      {a.title}
                    </p>
                    {a.excerpt && <p className="text-xs leading-relaxed text-neutral-500 line-clamp-2">{a.excerpt}</p>}
                    {a.publishedAt && (
                      <p className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-neutral-400">
                        <CalendarDays size={12} />
                        {new Date(a.publishedAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        )}
      </main>

      {/* Footer — dark, red accent */}
      <footer className="bg-neutral-950">
        <div className="h-1 w-full bg-gradient-to-r from-[#5c0000] via-[#990000] to-[#d92626]" />
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="flex flex-col gap-4 text-xs text-neutral-400 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <img src="/logo-koni-batam.png" alt="" className="h-8 w-8 object-contain" />
                <p className="text-sm font-bold text-white">KONI Kota Batam</p>
              </div>
              <p className="mt-2 max-w-md leading-relaxed">
                Kompleks Ruko KBC (Kuningan Business Centre) Blok A5 No. 1, Kel. Belian, Kec. Batam Kota,
                Kota Batam, Kepulauan Riau
              </p>
            </div>
            <div className="md:text-right">
              <a href="mailto:konikotabatam2024@gmail.com" className="font-medium text-neutral-300 hover:text-white">
                konikotabatam2024@gmail.com
              </a>
              <p className="mt-1">© {new Date().getFullYear()} KONI Kota Batam</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
