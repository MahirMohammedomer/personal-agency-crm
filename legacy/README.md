# legacy/ — old, unused code kept for reference

This folder holds an **older generation of the app** that is not part of the running
Next.js application (nothing in `src/` imports it, and it is excluded from
`tsconfig.json`, so it cannot break `npm run build`).

Two piles live here:

| Folder | What it is |
| --- | --- |
| `root-upload/` | Loose files that were uploaded to the repo root (a Vite-style SPA version of the same CRM, plus duplicate icons). They reference `@/pages/*`, `sonner`, `dexie`, `supabase`, `recharts`, `lucide-react`, `vite` env vars, etc. There is no Vite config in the repo, so this version could never build here. |
| `local-first-data-layer/` | The previous local-first data layer (`dexie` + Supabase sync): `db.ts`, `repos.ts`, `sync.ts`, `files.ts`, `auth.tsx`, `filters.ts`, `export.ts`, `websiteBrief.ts`, `migrateStatuses.ts`. The current app stores everything in PostgreSQL through `/api/*` routes and uses `src/lib/offline/*` for offline caching, so this layer is unused. |
| `local-first-ui/` | UI from that generation that is not imported by any page: `CommandPalette.tsx`, `QuickAdd.tsx` (×2), `Banners.tsx`, `SyncStatus.tsx`, `FilterPanel.tsx`, `LeadProfile.tsx`. Their replacements live in `src/components/` (server-backed command palette, quick add via `/leads?new=1`, sync indicator on the offline outbox, lead profile at `/leads/[id]`). |

Ideas worth salvaging from here (tracked in `RECOMMENDATIONS.md`): saved filter views,
pin/star leads, file attachments on projects, payments ledger, "Call Mode" and
"Work Mode" focus screens.
