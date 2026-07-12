import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/50 bg-white/75 p-4 shadow-xl backdrop-blur-xl md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-primary-50/60"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
