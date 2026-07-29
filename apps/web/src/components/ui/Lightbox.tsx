import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { resolveEmbedUrl, resolveFileUrl } from "../../lib/api";

export interface LightboxItem {
  key: string;
  label: string;
  fileUrl: string;
}

interface LightboxProps {
  items: LightboxItem[];
  /** Index into `items` currently shown. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
}

/**
 * Full-screen preview for a document (certificate, supporting file) so it can be
 * read without leaving the page. Images render directly; anything else (PDF)
 * goes in an iframe via `resolveEmbedUrl` — the API sends
 * `X-Frame-Options: SAMEORIGIN`, so an embed must use the web origin's path.
 */
export function Lightbox({ items, index, onIndexChange, onClose }: LightboxProps) {
  const item = items[index];
  const many = items.length > 1;

  // Escape closes, arrows page through. Registered once for the whole overlay
  // rather than per-button so it works no matter what has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (!many) return;
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + items.length) % items.length);
      if (e.key === "ArrowRight") onIndexChange((index + 1) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, many, onClose, onIndexChange]);

  // Stop the page behind the overlay from scrolling while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item.label}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center gap-2 p-3 text-white">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
        {many && (
          <span className="shrink-0 text-xs text-white/70">
            {index + 1} / {items.length}
          </span>
        )}
        <a
          href={resolveFileUrl(item.fileUrl)}
          target="_blank"
          rel="noreferrer"
          aria-label="Unduh"
          title="Unduh"
          className="shrink-0 rounded-full p-2 hover:bg-white/15"
        >
          <Download size={18} />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="shrink-0 rounded-full p-2 hover:bg-white/15"
        >
          <X size={18} />
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-3 sm:px-3"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {many && (
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + items.length) % items.length)}
            aria-label="Sebelumnya"
            className="shrink-0 rounded-full p-2 text-white hover:bg-white/15"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {isImageUrl(item.fileUrl) ? (
          <img
            src={resolveFileUrl(item.fileUrl)}
            alt={item.label}
            className="mx-auto max-h-full min-h-0 max-w-full object-contain"
          />
        ) : (
          <iframe
            src={resolveEmbedUrl(item.fileUrl)}
            title={item.label}
            className="mx-auto h-full w-full max-w-4xl rounded-lg bg-white"
          />
        )}

        {many && (
          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % items.length)}
            aria-label="Berikutnya"
            className="shrink-0 rounded-full p-2 text-white hover:bg-white/15"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}
