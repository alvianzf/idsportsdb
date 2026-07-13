# Design System — KONI Batam

Clean, solid-color UI. No gradients, minimal shadows, KONI red as the primary accent
reserved for key actions and active navigation state. Defined in
`apps/web/src/index.css` via Tailwind v4's `@theme` directive (no separate
`tailwind.config.ts` needed in v4).

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` (500) | `#C8102E` | KONI red — primary buttons, active nav, key CTAs |
| `primary-50`…`900` | `#FDECEF`…`#3D040F` | Hover/active states, subtle backgrounds (`primary-50`) |
| `neutral-50`…`900` | `#FAFAFA`…`#18181B` | Surfaces, borders, body text |
| `success` / `success-light` | `#16A34A` / `#DCFCE7` | Active status, approved |
| `warning` / `warning-light` | `#D97706` / `#FEF3C7` | Pending, training camp |
| `danger` / `danger-light` | `#DC2626` / `#FEE2E2` | Inactive, injured, rejected |
| `info` / `info-light` | `#2563EB` / `#DBEAFE` | Informational badges |
| `gold` / `silver` / `bronze` | `#D4AF37` / `#9CA3AF` / `#B45309` | Medal indicators |

## Typography

- Font: **Plus Jakarta Sans** (self-hosted via `@fontsource`, offline-safe for webview)
- Body: `text-sm` (14px) on mobile, `text-base` (16px) on desktop
- Headings: `text-lg`/`text-xl` for page titles (`PageHeader`)

## Components (`apps/web/src/components/ui/`)

- **`Button`** — solid `bg-primary` (primary), `bg-neutral-100` (secondary), bordered
  (outline), transparent (ghost). No gradients.
- **`Card`** — `bg-white border border-neutral-200 rounded-lg`, minimal/no shadow.
- **`Badge`** — pill (`rounded-full`), tone = success/warning/danger/info/neutral,
  uses `-light` background + matching text color. Used for `AthleteStatus`,
  `MutationStatus`, `Medal`.
- **`PageHeader`** — title + optional description + action buttons, responsive
  (`flex-col` on mobile, `flex-row` on desktop).

## Layout (`apps/web/src/layouts/`)

- **`AppLayout`** — top bar (mobile) + `Sidebar` (desktop, ≥768px) + `BottomNav`
  (mobile, ≤768px, max 4 items) + `<Outlet />`. Single layout, nav items vary by role
  via `navConfig.ts` (`navItemsForRole`).
- **Forms**: stacked fields on mobile, `md:grid-cols-2` on desktop.
- **Tables**: row dividers (`divide-y`), horizontal scroll on mobile, sticky header.
- Safe-area insets (`env(safe-area-inset-bottom)`) applied to `BottomNav` for
  Capacitor/notch devices (Phase 6).

## Icons

`lucide-react`, consistent stroke style, 18–20px in nav/cards.
