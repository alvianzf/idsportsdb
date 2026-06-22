# Spec: Database Indexing

## 1. Overview

- **Purpose & scope**: Define all database indexes beyond what Prisma auto-creates (PK and `@unique`
  constraints). Indexes are derived from observed query patterns across all API modules. This spec is
  the single source of truth for `@@index(...)` directives in `schema.prisma`.
- **Related optimization**: The dashboard query pattern was fully rewritten — 3 separate HTTP
  requests each firing multiple `Promise.all` queries were replaced by a single `/dashboard/all`
  endpoint backed by one `$queryRaw` that returns all counts + `json_agg` arrays in one round-trip
  (22–46ms warm vs. 2–7s before). `Prisma.groupBy()` and `findMany({ _count })` are explicitly
  avoided in this path. See `specs/002-dashboard/spec.md §3.2`.
- **No PDF module** — this is a cross-cutting infrastructure concern.
- **Glossary**:
  - `selective` — low cardinality relative to table size; index helps only when combined with other
    columns or the column is queried in isolation by a small result set
  - `composite index` — covers multiple columns; useful when queries always include all leading columns

---

## 2. Index Inventory

### 2.1 Existing indexes (already in schema)

These are correct and should be kept as-is.

| Model | Index columns | Reason |
|---|---|---|
| `User` | `cabangOlahragaId` | Scope admin-cabor FK lookup |
| `CaborDocument` | `caborId` | Document list per cabor |
| `Atlet` | `cabangOlahragaId` | Primary cabor filter (list, reports, dashboard) |
| `Atlet` | `statusAtlet` | Status filter on list page |
| `Atlet` | `kecamatan` | Per-kecamatan report grouping |
| `AtletCabor` | `cabangOlahragaId` | Additional-cabor membership scoping |
| `AtletDocument` | `(atletId, type)` | Document lookup per athlete + type filter |
| `Pelatih` | `cabangOlahragaId` | Coach list per cabor |
| `PengurusCabor` | `cabangOlahragaId` | Officials list per cabor |
| `PengurusCabor` | `reportsToId` | Org hierarchy child lookup |
| `Prestasi` | `atletId` | Achievement list per athlete |
| `Prestasi` | `tahun` | Year filter in report + groupBy |
| `Prestasi` | `medali` | Medal filter in report + groupBy |
| `MonitoringEvent` | `(atletId, type)` | Athlete timeline filtered by event type |
| `AtletCard` | `atletId` | Card lookup per athlete |
| `Article` | `(published, publishedAt)` | Public article feed (WHERE published=true ORDER BY publishedAt DESC) |
| `AuditLog` | `(entity, entityId)` | Audit trail per record |

### 2.2 Missing indexes — must add

#### A. `Prestasi.tingkatKejuaraan`

**Query evidence:**
- `GET /reports/prestasi` — `getPrestasiReport` filters by `tingkatKejuaraan` as a standalone
  optional predicate.
- `GET /dashboard/stats/prestasi?groupBy=tingkatKejuaraan` — Prisma `groupBy(["tingkatKejuaraan"])`.

No index exists. As achievement records accumulate this becomes a sequential scan.

```prisma
@@index([tingkatKejuaraan])
```

#### B. `Prestasi.(tahun, tingkatKejuaraan, medali)` — compound for report query

**Query evidence:** `getPrestasiReport` accepts all three as independent optional filters. When two
or more are combined the planner can use this compound instead of fetching and intersecting the three
single-column indexes.

Keep the three single-column indexes for single-predicate cases (groupBy, rekap). Add this compound
for multi-predicate report queries.

```prisma
@@index([tahun, tingkatKejuaraan, medali])
```

#### C. `MonitoringEvent.(type, mutationStatus)`

**Query evidence:**
- `GET /monitoring/mutasi` — `WHERE type = 'MUTATION' AND mutationStatus = ?`
- `PATCH /monitoring/:id/mutasi` — after approve, re-queries for athlete by `atletId` (already
  covered), but the queue fetch above is unindexed.

The existing `(atletId, type)` composite does **not** help here — the queue query has no `atletId`
predicate.

```prisma
@@index([type, mutationStatus])
```

#### D. `AtletCard.(atletId, isRevoked)`

**Query evidence:** `getCurrentCard(atletId)` in `cards.service.ts`:
```ts
prisma.atletCard.findFirst({
  where: { atletId, isRevoked: false },
  orderBy: { issuedAt: "desc" },
})
```

The current single-column `atletId` index scans all cards for an athlete then filters `isRevoked`
in memory. A composite index allows the engine to satisfy both predicates in the index scan.

```prisma
@@index([atletId, isRevoked])
```

> Replace the existing `@@index([atletId])` with this composite — it is a superset.

#### E. `Atlet.(cabangOlahragaId, statusAtlet)`

**Query evidence:**
- `GET /dashboard/summary` — `atlet.count({ where: { statusAtlet: "ACTIVE", cabangOlahragaId: caborId } })` — this is the most-executed query in the system (every dashboard load).
- `GET /public/stats` — `atlet.count({ where: { statusAtlet: "ACTIVE" } })` — full-table count; single `statusAtlet` index helps.

Both `cabangOlahragaId` and `statusAtlet` individual indexes exist. For the dashboard's combined
predicate, a composite index eliminates the need to intersect two index scans.

```prisma
@@index([cabangOlahragaId, statusAtlet])
```

> Keep the existing single-column indexes too — the `statusAtlet` index is still used for the
> public stats count (no `cabangOlahragaId` predicate) and for the athlete list status-only filter.

#### F. `AuditLog.userId`

**Query evidence:** Audit log views filter by the acting user. Only `(entity, entityId)` exists
today. A user's audit history is a natural admin query for accountability reporting.

```prisma
@@index([userId])
```

#### G. `AuditLog.createdAt`

**Query evidence:** Audit log rows are paginated/sorted newest-first. Without an index on
`createdAt`, sorting requires a sequential scan of the entire table, which grows without bound.

```prisma
@@index([createdAt])
```

#### H. `Article.authorId`

**Query evidence:** `GET /artikel` admin list filters/sorts by author. With many articles, a
sequential scan is avoidable.

```prisma
@@index([authorId])
```

### 2.3 Deferred / not recommended

| Candidate | Reason skipped |
|---|---|
| `Atlet.tanggalLahir` | Age report loads all `tanggalLahir` values into JS; index can't accelerate that. Revisit if the report is rewritten to use a DB age expression. |
| `User.isActive` | User table is always small (tens of records); index overhead > benefit. |
| `Pelatih.masaBerlakuAkhir` | No current query filters on this field. Add if an expiry report is built. |
| `AtletCard.expiresAt` | Expiry is checked after a `cardCode` unique-key lookup — not a filter in its own right. |
| `Atlet.namaLengkap` (text search) | B-tree index doesn't accelerate `ILIKE '%...%'`. Requires `pg_trgm` GIN index. Defer until search latency is measured as a problem. |

---

## 3. Implementation

### 3.1 Schema changes (`apps/api/prisma/schema.prisma`)

Apply these diffs to the relevant models:

**`Atlet`** — add composite, keep singles:
```prisma
@@index([cabangOlahragaId])
@@index([statusAtlet])
@@index([kecamatan])
@@index([cabangOlahragaId, statusAtlet])   // ADD
```

**`Prestasi`** — add `tingkatKejuaraan` single + compound:
```prisma
@@index([atletId])
@@index([tahun])
@@index([medali])
@@index([tingkatKejuaraan])                        // ADD
@@index([tahun, tingkatKejuaraan, medali])         // ADD
```

**`MonitoringEvent`** — add mutation queue index:
```prisma
@@index([atletId, type])
@@index([type, mutationStatus])                    // ADD
```

**`AtletCard`** — replace single-column with composite:
```prisma
// @@index([atletId])                              // REMOVE
@@index([atletId, isRevoked])                     // ADD (superset)
```

**`Article`** — add author index:
```prisma
@@index([published, publishedAt])
@@index([authorId])                               // ADD
```

**`AuditLog`** — add user and time indexes:
```prisma
@@index([entity, entityId])
@@index([userId])                                 // ADD
@@index([createdAt])                              // ADD
```

### 3.2 Applying to the database

```bash
# Development (remote DB without CREATEDB — see tech-stack.md)
npx prisma db push

# Local Docker (migration history needed)
npx prisma migrate dev --name add_missing_indexes
```

No data migrations needed — index creation in PostgreSQL is safe on live tables (uses
`CREATE INDEX` which does not block reads).

### 3.3 Verification

After applying, confirm with `EXPLAIN ANALYZE` on the key queries:

```sql
-- Dashboard summary (most frequent)
EXPLAIN ANALYZE
SELECT COUNT(*) FROM "Atlet"
WHERE "cabangOlahragaId" = '<id>' AND "statusAtlet" = 'ACTIVE';
-- Expect: Index Scan on Atlet_cabangOlahragaId_statusAtlet_idx

-- Mutation queue
EXPLAIN ANALYZE
SELECT * FROM "MonitoringEvent"
WHERE type = 'MUTATION' AND "mutationStatus" = 'PENDING';
-- Expect: Index Scan on MonitoringEvent_type_mutationStatus_idx

-- getCurrentCard
EXPLAIN ANALYZE
SELECT * FROM "AtletCard"
WHERE "atletId" = '<id>' AND "isRevoked" = false
ORDER BY "issuedAt" DESC LIMIT 1;
-- Expect: Index Scan on AtletCard_atletId_isRevoked_idx
```

---

## 4. Acceptance Criteria

- All `@@index` directives in §3.1 are present in `schema.prisma`.
- `npx prisma db push` (or migrate) succeeds without errors.
- `EXPLAIN ANALYZE` on the three queries in §3.3 shows index scans (not sequential scans).
- No existing query is regressed — all existing `@@index` directives from §2.1 remain.

---

## 5. Dependencies

- Depends on: all data-bearing specs (`004-atlet`, `007-prestasi-atlet`, `008-monitoring-atlet`,
  `009-pelaporan`, `010-kartu-atlet-digital`, `011-artikel`, `001-auth-rbac`)
- Tooling: `prisma db push` or `prisma migrate dev` (see `specs/000-overview/tech-stack.md`)
