# Spec: <Module Name> (<English name>)

## 1. Overview

- **Purpose & scope**:
- **PDF reference**: Modul <letter> — "<title>" (KONI-Batam_WebApp.pdf)
- **Glossary** (Indonesian → English):
  - `term` — meaning

## 2. Data Model

- **Entity**: `EntityName`
  - `field: Type` — description, constraints
- **Relationships**: ...
- **Enums**: reference `@inasportdb/shared-types`
- **Indexes / unique constraints**: ...

## 3. API Contract

| Method | Path | Roles Allowed | Request Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/...` | ... | - | ... | ... |

- **Validation**: zod schema name(s) in `apps/api/src/modules/<module>/<module>.schema.ts`
- **Pagination/filter/sort**: query params supported

## 4. UI / Pages

- **Route(s)**: `/...`
- **Component**: `apps/web/src/pages/...`
- **Mobile layout**: what's visible/hidden on small screens
- **Desktop layout**: additional columns/panels
- **Components used**: forms, tables, cards
- **Empty / loading / error states**:

## 5. Role-Based Behavior

| Role | View | Create | Update | Delete | Notes |
|---|---|---|---|---|---|
| SUPER_ADMIN_KONI | | | | | |
| ADMIN_KONI | | | | | |
| ADMIN_CABOR | | | | | scoped to own `cabangOlahragaId` |
| ATLET | | | | | |

## 6. Acceptance Criteria

- Given ..., when ..., then ...

## 7. Open Questions / Assumptions

- ...

## 8. Dependencies

- Depends on: `specs/<NNN-name>/spec.md`
