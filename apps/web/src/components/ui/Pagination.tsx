import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-3 flex items-center justify-between text-sm text-neutral-600">
      <span>
        Halaman {page} dari {totalPages} &middot; {total} data
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="px-2 py-1"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="outline"
          className="px-2 py-1"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
