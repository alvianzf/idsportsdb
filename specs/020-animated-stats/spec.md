# Spec: Animated Stat Counters (Count-up on View)

## 1. Overview

- **Purpose & scope**: Numeric statistic values should animate a count-up from
  `0` to their target when the containing card first scrolls into view, rather
  than appearing instantly. Purely a presentation enhancement — no data model,
  API, or role behavior changes. Applies wherever aggregate stat numbers are
  shown: the authenticated Dashboard stat cards and the public Landing page
  statistics.
- **PDF reference**: N/A — UI polish, not a PDF requirement.
- **Glossary**:
  - `count-up` — animating a number from a start value up to its final value
    over a short duration.
  - `on view` — triggered when the element enters the viewport
    (`IntersectionObserver`), not on mount.

## 2. Data Model

No new entities, columns, or enums. Consumes existing numeric fields already
returned by the dashboard/public endpoints (see §8).

## 3. API Contract

No API changes. Values come from existing endpoints:
- `GET /api/v1/dashboard/all` → `summary.{activeAtletCount, pelatihCount, caborCount, prestasiCount, prestasiCountAll}` (`specs/002-dashboard`).
- `GET /api/v1/public/stats` → `{ caborCount, activeAtletCount, pelatihCount }` (`specs/018-public-pages`).

## 4. UI / Pages

- **New component**: `apps/web/src/components/ui/CountUp.tsx` — a small
  presentational component (and/or a `useCountUp` hook) that renders an animated
  integer.
  - Props: `value: number`, optional `durationMs` (default ~1200), optional
    `format` (default `toLocaleString('id-ID')` for thousands grouping).
  - Behavior: starts at `0`, animates to `value` with an ease-out curve using
    `requestAnimationFrame`; only begins once the element has intersected the
    viewport (`IntersectionObserver`, threshold ~0.2), and **runs once per
    mount** (does not replay on scroll away/back).
  - Re-target: if `value` changes after the first animation (e.g. Dashboard year
    filter re-fetch), animate from the current displayed number to the new
    `value`.
- **Integration points**:
  - `apps/web/src/pages/DashboardPage.tsx` — `StatCard` currently renders
    `value: string | number`. Animate only when `value` is a finite number;
    render the raw placeholder (`—`) unchanged while loading.
  - `apps/web/src/pages/LandingPage.tsx` — the public statistics block
    (`caborCount`, `activeAtletCount`, `pelatihCount`).
- **Loading / empty states**: no animation while data is absent — show the
  existing `—` placeholder. When data arrives, the number animates from `0`.
  A value of `0` renders as `0` (no animation needed, but must not show `—`).
- **Formatting**: preserve existing formatting (integer, `id-ID` grouping);
  intermediate frames are rounded integers (no fractional flicker).

## 5. Role-Based Behavior

No role differences — the animation is cosmetic and applies identically to any
role that can already see the given stat (Dashboard: admin roles per
`002-dashboard`; Landing: unauthenticated public).

## 6. Acceptance Criteria

- Given the Dashboard has loaded its counts, when a stat card first scrolls into
  view, then its number animates from `0` up to the final value over ~1.2s and
  stops exactly on the final value (correctly formatted, no overshoot).
- Given the animation has already played for a card, when the user scrolls it
  out of and back into view, then it does **not** replay.
- Given the user changes the Dashboard year filter, when new counts arrive, then
  the affected numbers animate from their current displayed value to the new one.
- Given a stat value is `0`, when it comes into view, then it shows `0` (not `—`
  and not a stuck animation).
- Given the user has `prefers-reduced-motion: reduce` set, when a stat comes into
  view, then the final value is shown immediately with **no** count-up.
- Given data is still loading, when the card renders, then the existing `—`
  placeholder shows and no animation runs.

## 7. Open Questions / Assumptions

- **Reduced motion**: assumed we honor `prefers-reduced-motion` and skip the
  animation entirely (final value shown at once). This is the accessible default.
- **Duration/easing**: assumed ~1200ms with an ease-out curve; not yet
  design-signed-off — a single shared default keeps all counters consistent.
- **No new dependency**: assumed implemented with `requestAnimationFrame` +
  `IntersectionObserver` (both already used in the codebase) rather than adding a
  count-up library. `framer-motion` is present but not required for this.
- Only integer stats are in scope; there are currently no decimal/currency stats.

## 8. Dependencies

- Depends on: `002-dashboard` and `018-public-pages` (the stat values and the
  `StatCard` / landing stats UI this enhances). UI-only; no backend work.
