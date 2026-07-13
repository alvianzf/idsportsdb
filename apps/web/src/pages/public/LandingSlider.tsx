import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, resolveFileUrl } from "../../lib/api";
import { getSocket } from "../../lib/socket";

interface Slide {
  id: string;
  imageUrl: string;
  caption: string | null;
  linkUrl: string | null;
}

const AUTO_ADVANCE_MS = 5000;

/** Full-width photo slider on the landing page, managed by superadmin
 * (specs/019-landing-slider). Renders nothing when no active slides exist. */
export function LandingSlider() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);

  const load = useCallback(() => {
    api
      .get<Slide[]>("/public/slider")
      .then((res) => {
        setSlides(res.data);
        setIndex(0);
      })
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("slider:change", load);
    return () => {
      socket.off("slider:change", load);
    };
  }, [load]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[index];
  const img = (
    <img
      src={resolveFileUrl(slide.imageUrl)}
      alt={slide.caption ?? ""}
      className="h-full w-full object-cover"
    />
  );

  return (
    <section className="relative w-full overflow-hidden bg-neutral-900">
      <div className="relative aspect-[2/1] max-h-[520px] w-full sm:aspect-[3/1]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={slide.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {slide.linkUrl ? (
              <a href={slide.linkUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
                {img}
              </a>
            ) : (
              img
            )}
            {slide.caption && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-5 pt-14 md:px-8">
                <p className="mx-auto max-w-6xl text-sm font-semibold text-white drop-shadow md:text-lg">
                  {slide.caption}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {slides.length > 1 && (
        <>
          <button
            aria-label="Sebelumnya"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur transition hover:bg-black/60"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Berikutnya"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur transition hover:bg-black/60"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
