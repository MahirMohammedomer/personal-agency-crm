# Meda CRM — mobile responsiveness pass + "make it 10× better" roadmap

_Scope of the code change: mobile / small-screen UI & UX only. No features, data models or business
logic were altered while fixing layouts. Everything below was measured in a real headless Chromium at
320 / 360 / 390 / 768 / 1024 px, light and dark, portrait and landscape._

---

## 1. What was fixed (and how it was verified)

### 1.1 Page frame

| Problem | Fix |
| --- | --- |
| The app shell was as tall as its content, so the **whole document scrolled** and the sticky top bar + bottom tab bar did not stay put on phones. | The shell root is now clamped to the viewport (`overflow-hidden`), and only the content area scrolls. Verified on every route at 320×568 — `document.scrollTop` stays `0`, header `top = 0`, tab bar always visible. |
| `html/body { height: 100% }` ignores mobile browser chrome (URL bar), causing 100vh jumps. | `100dvh` is applied when supported (with `100%` fallback), so the layout never jumps when the address bar hides. |
| Long emails / URLs could widen the page. | `overflow-x: clip` on `body` — the page **never scrolls sideways**; all 14 routes measured `scrollWidth == innerWidth` at 320, 360 and 390 px. |

### 1.2 Touch ergonomics (the "fat finger" pass)

* Every shared button grew to a **≥ 40 px** target on phones and shrinks back on `≥ sm` screens
  (`ui.tsx` + `primitives.tsx` size maps), so desktop density is untouched: CSV/Excel/Import/New-lead,
  card actions, pipeline card actions, follow-up actions, project tabs, filter chips, calendar legend.
* Hand-rolled icon buttons on the dashboard, pipeline, project detail, lead detail and contacts panel
  are 40 × 40 px on phones (`… sm:h-7 sm:w-7`).
* The tiny 16 px checkboxes (lead selection, task done) and the inline "✕" remove buttons now carry an
  invisible expanded hit area, so a thumb can hit them without pixel-hunting.
* Header controls (burger, search, sync pill, quick-add, avatar) are all ≥ 40 px; at 320 px they use
  100 % of the row with no cramped overlap.
* `touch-action: manipulation` + no tap highlight on coarse pointers removes the 300 ms tap delay and
  the grey flash.

### 1.3 Keyboard / input behaviour on phones

* Browsers zoom the whole page when an input smaller than 16 px is focused. All `input`s, `select`s and
  `textarea`s are now **16 px on ≤ 767 px screens** (desktop sizes unchanged), so tapping a field never
  zooms the page.
* Fields are at least 44 px tall on phones (`.field` override).

### 1.4 Overlays, modals and menus

* Bottom-sheet behaviour on phones, centred dialog on `≥ sm`, `max-h` now uses `dvh` so the sheet is
  never cut off by mobile browser chrome; footers are `flex-wrap` and respect the home-bar safe area.
* Dropdown panels are capped at `70dvh` and scroll internally — a long account or filters menu can no
  longer run off the top of a small screen.
* Toasts sit **above the bottom tab bar** (so they are never hidden behind it), span the width on
  phones, and wrap instead of clipping.
* The mobile drawer, command palette and every dialog were opened in-browser at 320 px and confirmed to
  fit with zero horizontal overflow.

### 1.5 Layouts that used to break at small widths

* `PageHeader` stacks its title and actions on phones with smaller type; empty states, list rows,
  follow-up cards, calendar legend/toolbar, task board, project tabs and detail rows all reflow.
* The virtualized leads table keeps a horizontal scroller on tablets (measured: 860 px content inside a
  482 px viewport, scrollable), with its height clamped so it stays usable on short/landscape screens.
  Phones (< 768 px) automatically use the touch card view instead.
* Card grids (dashboard stats, projects, lead cards, task board, analytics tiles) collapse to 1–2
  columns down to 320 px.
* New `xs` breakpoint (`< 400 px`) added to the design system for extra-small phones; safe-area
  utilities (`pb-safe`, `pt-safe`), an `.scroll-x` helper and a reduced-motion guard were added to
  `globals.css`.

### 1.6 Verified results

Measured with headless Chromium over all routes (`/`, `/leads`, `/leads/:id`, `/pipeline`,
`/follow-ups`, `/projects`, `/projects/:id`, `/tasks`, `/clients`, `/calendar`, `/analytics`, `/import`,
`/settings`, `/login`):

* horizontal page overflow: **0 px on every route at 320 / 360 / 390 / 768 / 1024 px**; the document
  itself never scrolls (only the content column does), on all 14 routes.
* elements smaller than 40 px at 390 px, before → after: dashboard **59 → 27**, pipeline **33 → 7**,
  follow-ups **21 → 7**, projects **16 → 1**, project detail **38 → 18**, lead detail **30 → 12**,
  leads **34 → 32**, calendar **10 → 5**, analytics **19 → 17**, settings **11 → 9**, login **5 → 2**,
  import **3 → 2**, tasks/clients **4 → 2**. What remains is inline text links ("All →", job titles)
  and hover-only controls that are not used on touch — normal for dense list rows.
* production build passes (`npm run build`), TypeScript passes (`npx tsc --noEmit`), and the final sweep
  reports **no JavaScript errors, no console errors, no horizontal overflow and no document scroll** on
  any route at 320 px and 390 px.

### 1.7 Real bugs that were in the way (fixed, behaviour unchanged)

* **`/tasks` was a dead link.** It was listed in the sidebar, the command palette and the shortcuts card
  but had no page (404). A mobile-first Tasks page was added — grouped by Overdue / Today / Next 7 days
  / Later / Completed, with search, a priority filter, one-tap complete and quick add. It is the item
  you tap most from a phone, so it could not stay a dead end.
* **`npm run dev` never hydrated.** The middleware matcher swallowed `_next/webpack-hmr`, so the HMR
  socket was rejected (`ERR_INVALID_HTTP_RESPONSE`) and every page in development rendered its HTML but
  attached no React — nothing was clickable. Fixed in `src/middleware.ts` so dev behaves like
  production.
* **Two hydration mismatches (React error #418) were corrupting the first paint on every page:**
  the sync pill rendered "Synced 5 min ago" from `localStorage` during hydration (server HTML said
  "Synced"), and the dashboard greeting/date were computed from the *server's* clock and locale, which
  is wrong for a user in another timezone for up to three hours a day. Both now render the
  time-dependent text only once the client owns the DOM. The final sweep above is clean because of it.

---

## 2. Recommended next steps — biggest wins first

Grouped by impact for a one-person agency that sells websites to Ethiopian businesses. Each item says
what it is, why it pays off, and roughly what it takes.

### Tier 1 — direct revenue and time savers

1. **WhatsApp-first outreach with message templates (highest ROI).**
   Pre-fill `wa.me` deep links with a personalized message built from lead fields (name, niche, city,
   "I noticed you have no website"), plus saved templates per niche/language (English + አማርኛ), and log
   the touch point automatically. Today the WhatsApp button opens an empty chat — a filled message
   converts much better and saves copy-paste time on every single lead. _Effort: small (client-side
   template + settings key)._

2. **Follow-up reminders that actually reach you (PWA notifications + daily digest).**
   The app already has follow-ups with due dates; add Web Push / notification permission on install plus
   a "3 overdue follow-ups today" digest, and a scheduled summary (07:00). Without a reminder, follow-ups
   silently rot — this is the single biggest leak in a lead pipeline. _Effort: medium (needs VAPID keys,
   push subscribe endpoint, and a cron/worker)._

3. **Proposal & quote generator using the website-brief data.**
   The brief dialog already produces a filled spec. Turn it into a one-click branded PDF/HTML proposal
   with scope, timeline, an ETB price (default project value already exists in preferences), and a
   deposit request — sent over WhatsApp/Telegram. Also produces a client-facing "prototype link" that is
   already stored on the lead. _Effort: medium._

4. **Payment tracking that closes the loop.**
   Projects have `value`/`paid`; add installments (deposit / milestone / final), an overdue balance
   badge with days-late, a "remind on WhatsApp" button that pre-fills the amount owed, and a revenue
   chart of collected vs outstanding per month. The dashboard already flags outstanding money —
   finishing the collection flow is pure cash-flow improvement. _Effort: medium._

5. **One-tap activity logging with outcomes, not just "called".**
   After a call/WhatsApp, ask for the outcome in a single tap (No answer / Not interested / Interested /
   Asked for price / Meeting set) and update the lead status automatically. This turns the activity log
   from a diary into a funnel and gives analytics something real to chart. _Effort: small–medium._

6. **Auto-suggested next action per lead (a real "What should I do now?").**
   The dashboard panel is already there; scoring it by due date, lead score, tier, value and staleness
   ("no contact for 12 days") turns it into a work queue you can trust. Keep it a *suggestion* — never
   overwrite imported lead scores. _Effort: small (pure ranking function + query)._

### Tier 2 — make daily use faster

7. **Saved views / segments for leads.** "Tier 1 no-website Addis", "replied last 7 days" — one tap,
   bookmarked, shown on the dashboard. Removes re-building the same 6 filters every morning.
   _Effort: small (persist the existing filter object)._
8. **Global search across everything.** `/api/search` already exists; wire it into the mobile header so
   ⌘K / tap-search finds leads, projects, notes, tasks and contacts, not just navigate.
   _Effort: small._
9. **Bulk actions on the phone.** The bulk bar exists; add long-press multi-select in card view and
   "Archive out of business" / "Tag as wrong number" presets. _Effort: small._
10. **Import review with duplicate decisions remembered.** The analyze step already classifies
    create/update/skip — let it show a diff and remember choices per column mapping for next time
    (column-mapping presets). _Effort: small–medium._
11. **Amharic / English UI toggle + Ethiopian (Ge'ez) dates where appropriate.** The audience is
    Ethiopian; the calendar view in particular would feel native in ዓ.ም. Keep Gregorian for storage.
    _Effort: medium (i18n scaffold + translations)._
12. **Lazy-load heavy libraries.** `xlsx` (~800 KB) is imported on the leads page route; move export to
    a dynamic import so the first paint on a mid-range Android is much faster. _Effort: tiny._

### Tier 3 — robustness, trust and polish

13. **Fix the PWA assets (they are still from the older build).**
    `public/manifest.webmanifest` says "Agency OS", uses a dark theme colour while the app defaults to
    light, and its shortcuts point at hash routes (`/#/leads`) that don't exist in this app — so the
    home-screen shortcuts 404. `public/sw.js` falls back to `/index.html`, which doesn't exist in a
    Next.js app, so **offline navigation can fail**; it also still filters Supabase URLs.
    Rebuild both for the Next routes (`/leads`, `/follow-ups`, `/import`), cache `/offline.html` as the
    fallback, and bump the cache version. _Effort: small, high trust payoff._
14. **Daily automatic backup to a file you control.** `/api/export?scope=all` already returns a full
    JSON snapshot; add a nightly server-side dump to disk (and optional Google Drive) plus a "restore
    from backup" screen. One-person CRMs die from lost datasets. _Effort: medium._
15. **Offline-first polish.** The outbox/sync engine exists; surface it better — a persistent "3 changes
    waiting to sync" banner, retry-all, and a conflict review screen with a diff. _Effort: medium._
16. **Onboarding checklist + demo data toggle.** First run: import, add first project, set price
    defaults, install the app on your phone (QR code). Massively lowers the "empty app" drop-off.
    _Effort: small._
17. **Health & integrity page.** Show DB size, last backup, duplicate count, leads with no phone,
    orphaned projects, failed syncs — a 30-second weekly check. _Effort: small._
18. **Tablet/desktop density preference.** Because buttons now grow on phones, offer a "compact
    density" preference for desktop power users. _Effort: tiny._

### Small fixes worth bundling

* Client detail rows show raw `www.google.com/maps/...` URLs — show "Open in Maps" instead.
* `sitemap` of stale statuses: `controls.tsx` lists 10 statuses; make sure Analytics funnel labels stay
  in sync when statuses change (single source of truth for the enum).
* Empty `public/` icons are 100 KB+ PNGs; convert to WebP/AVIF to speed up install on slow networks.
* The login screen is the only page without the app shell — add a small "install app" hint there too.

---

## 3. Suggested order if you do only three things

1. WhatsApp message templates + one-tap outcome logging (Tier 1 #1 and #5) — more replies per hour.
2. Follow-up reminders / push digest (Tier 1 #2) — stops deals dying quietly.
3. Proposal + payment tracking (Tier 1 #3 and #4) — turns conversations into collected ETB.

Everything in Tier 1 works entirely inside the current data model, so none of it risks the responsive
fixes shipped here.
