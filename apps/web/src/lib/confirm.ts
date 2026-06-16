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
  });
  return result.isConfirmed;
}
