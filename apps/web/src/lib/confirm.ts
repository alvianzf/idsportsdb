import Swal from "sweetalert2";

interface ConfirmOptions {
  title?: string;
  text: string;
  confirmText?: string;
  danger?: boolean;
}

/** SweetAlert2-based replacement for window.confirm(). */
export async function confirmAction({
  title = "Konfirmasi",
  text,
  confirmText = "Ya, lanjutkan",
  danger = true,
}: ConfirmOptions): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Batal",
    confirmButtonColor: danger ? "#dc2626" : "#c8102e",
    cancelButtonColor: "#a1a1aa",
    reverseButtons: true,
    // Glassmorphism to match Modal/Card (revisi 2026-07-18).
    background: "rgba(255, 255, 255, 0.75)",
    backdrop: "rgba(0, 0, 0, 0.3)",
    customClass: {
      container: "backdrop-blur-sm",
      popup: "rounded-3xl border border-white/50 shadow-xl backdrop-blur-xl",
    },
  });
  return result.isConfirmed;
}
