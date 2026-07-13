import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, Upload, X } from "lucide-react";
import toast from "react-hot-toast";

interface DropZoneProps {
  /** MIME type or extension filter, e.g. "image/*" or ".pdf,.docx" */
  accept?: string;
  /** File or null when cleared */
  onChange: (file: File | null) => void;
  /** Currently staged file (controlled) */
  value?: File | null;
  /** URL of an already-uploaded file to show as preview */
  existingUrl?: string | null;
  /** Primary hint text below the icon */
  label?: string;
  /** Secondary hint (file types / size limit) */
  sublabel?: string;
  disabled?: boolean;
  className?: string;
}

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
}

/**
 * Whether a file matches the `accept` filter (extensions, mime types, or wildcards
 * like image/*). The `accept` attribute only gates the file picker, so drag-drop
 * must check this itself. Type only — size is left to the server.
 */
function matchesAccept(file: File, accept?: string): boolean {
  const tokens = (accept ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function DropZone({
  accept,
  onChange,
  value,
  existingUrl,
  label = "Seret & lepas file di sini",
  sublabel,
  disabled = false,
  className = "",
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function apply(file: File) {
    if (isImage(file.name)) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
    onChange(file);
  }

  function clear() {
    setPreviewUrl(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) apply(f);
    e.target.value = "";
  }

  function onDragOver(e: DragEvent) {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  }

  function onDrop(e: DragEvent) {
    if (disabled) return;
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!matchesAccept(f, accept)) {
      toast.error(`Jenis berkas tidak didukung. Gunakan ${accept}.`);
      return;
    }
    apply(f);
  }

  const displayUrl = previewUrl ?? existingUrl ?? null;
  const hasFile = value != null;
  const showPreview = displayUrl && (hasFile ? isImage(value!.name) : true);

  if (hasFile || existingUrl) {
    // ── File selected / existing ─────────────────────────────────────
    return (
      <div className={`flex items-start gap-3 ${className}`}>
        {/* Thumbnail or file icon */}
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
          {showPreview ? (
            <img src={displayUrl!} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-400">
              <FileText size={24} />
              <span className="max-w-[6rem] truncate px-1 text-center text-xs">
                {value?.name ?? "Berkas"}
              </span>
            </div>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={clear}
              title="Hapus"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* File info + replace */}
        {!disabled && (
          <div className="flex flex-col gap-1.5 text-xs text-neutral-500">
            {value && <p className="max-w-[12rem] truncate font-medium text-neutral-700">{value.name}</p>}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-primary hover:underline"
            >
              Ganti file
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
    );
  }

  // ── Empty drop zone ──────────────────────────────────────────────
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
        dragging
          ? "border-primary bg-primary-50"
          : disabled
          ? "cursor-not-allowed border-neutral-200 bg-neutral-50"
          : "border-neutral-300 bg-neutral-50 hover:border-primary hover:bg-primary-50"
      } ${className}`}
    >
      <Upload size={24} className={dragging ? "text-primary" : "text-neutral-400"} />
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-700">{label}</p>
        {sublabel && <p className="mt-0.5 text-xs text-neutral-400">{sublabel}</p>}
        <p className="mt-0.5 text-xs text-neutral-400">atau klik untuk memilih</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
