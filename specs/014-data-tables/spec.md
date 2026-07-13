# Spec: Data Tables (Sortable, Filterable, Multi-Select)

## 1. Overview

- **Purpose & scope**: All list pages use a shared `DataTable` component that
  provides column sorting, multi-select checkboxes, bulk action execution, and
  mobile-responsive column collapse. Replaces bare `<table>` elements across the
  app.

## 2. Component API

**File**: `apps/web/src/components/ui/DataTable.tsx`

```typescript
interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  mobile?: boolean;       // show on mobile; others collapse on small screens
  className?: string;
  getValue?: (row: T) => string | number | Date | null | undefined;  // for sort
  render: (row: T) => ReactNode;
}

interface BulkAction {
  label: string;
  icon?: React.ElementType;
  variant?: "danger" | "outline";
  onClick: (ids: string[]) => void;  // receives array of selected row ids
}

<DataTable<T extends { id: string }>
  columns={Column<T>[]}
  rows={T[]}
  bulkActions?: BulkAction[]
  emptyMessage?: string
/>
```

## 3. Behaviour

### Sorting
- Click a column header with `sortable: true` to sort ascending; click again to
  reverse. Sort state is local to the component (client-side on the fetched page).
- Sort icon: `ChevronsUpDown` (inactive) → `ChevronUp` / `ChevronDown` (active).
- Selecting rows resets when sort changes.

### Multi-select
- First column (when `bulkActions` provided): checkbox. Header checkbox selects /
  deselects all; shows indeterminate when partial.
- Selected rows highlighted with `bg-primary-50`.

### Bulk action toolbar
- Appears above the table when ≥1 row is selected.
- Shows count ("N dipilih") and action buttons.
- After an action fires, selection is cleared.

### Mobile collapse
- Columns with `mobile: true` always show.
- Columns without `mobile` are hidden via `hidden md:table-cell`.
- A chevron cell (`md:hidden`) appears in the last column on mobile; clicking it
  toggles an expanded sub-row showing the hidden columns as a `<dl>` grid.

## 4. Pages using DataTable

| Page | Mobile columns | Bulk actions |
|---|---|---|
| AtletListPage | Nama, Status | Hapus (UNSCOPED_ADMIN only) |
| PelatihListPage | Nama, Masa Berlaku | Hapus (UNSCOPED_ADMIN only) |
| PrestasiListPage | Atlet, Hasil | Hapus (DATA_ADMIN) |
| CaborListPage | Nama, Atlet count | Hapus (UNSCOPED_ADMIN only) |
| UsersListPage | Nama, Role | Nonaktifkan |

## 5. Bulk delete pattern

```typescript
async function handleBulkDelete(ids: string[]) {
  if (!(await confirmAction({ text: `Hapus ${ids.length} item?`, danger: true }))) return;
  const results = await Promise.allSettled(ids.map((id) => api.delete(`/entity/${id}`)));
  const failed = results.filter((r) => r.status === "rejected").length;
  failed ? toast.error(...) : toast.success(...);
  setReloadKey((k) => k + 1);  // bump dep to trigger useEffect re-fetch
}
```

## 6. Constraints

- Sorting is client-side on the current page. For paginated endpoints (atlet,
  pelatih, prestasi), sort applies within the fetched page only.
- Server-side sorting can be added later by passing `sort` params to API and
  removing local sort logic from DataTable.
