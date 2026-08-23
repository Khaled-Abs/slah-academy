# SLAH Academy — Whole-Platform Visual Redesign
# Single prompt for Claude Code — run inside the existing repo (khaled-abs/slah-academy)

---

## Role

Act as senior front-end developer, senior graphic designer, and senior UX/UI designer. This is a **visual-only redesign** of an already-working, already-deployed application. Every function, data flow, Supabase call, and interaction currently in the codebase must keep working exactly as it does today. You are re-skinning a real product, not prototyping a new one — treat the existing markup, IDs, and data-attributes as load-bearing.

---

## What you are redesigning

The full SLAH Academy platform, as it exists in this repo today:

- `index.html` — login
- `app.html` — main app shell (icon rail + sidebar + dashboard + classe view), driven by `js/app.js`, `js/render.js`, `js/compute.js`, `js/db.js`, `js/auth.js`
- `calendar.html` — weekly session planner, built on FullCalendar v5
- `css/style.css` — the single stylesheet for `index.html` and `app.html`

Do not touch: `js/db.js`, `js/auth.js`, `js/compute.js`, Supabase calls, CSV export logic (`toCp1252Bytes`, `exportClasseCsv`), print logic (`buildPrintReport`, `printClasse`), hash-routing logic (`updateHash`/`parseHash`), or any business logic in `js/app.js`. You may add classes to markup produced by `js/render.js` template strings for styling hooks. You may restructure inner HTML of a component (e.g. wrap a stat card's icon in a new span) as long as every ID and data-attribute listed in the **Preservation Contract** below still exists and still means the same thing.

---

## PRESERVATION CONTRACT — do not rename or remove

`js/app.js` queries the DOM directly by these exact IDs, classes, and data-attributes. Every one of them must still exist, with the same meaning, after the redesign. You may add new classes alongside them freely.

**IDs:** `#mainContent` `#sideNav` `#iconRail` `#railLevels` `#railExpandHint` `#navPinBtn` `#navToggle` `#drawerBackdrop` `#loadingOverlay` `#userEmail` `#logoutBtn` `#anneeBadge` `#anneeMenu` `#yearPill` `#yearMenu` `#studentTable` `#studentSearch` `#searchClear` `#searchHint` `#addPanel` `#addNumero` `#addNom` `#addContact` `#addError` `#btnAddStudent` `#btnAddSubmit` `#btnAddCancel` `#btnBackDashboard` `#btnReport` `#reportMenu` `#printReport` `#btnRetry` `#summaryBar`

**Classes used as selectors (not just styling):** `.nav-item` `.nav-classe` `.nav-level` `.rail-item` `.rail-mono` `.rail-flyout` `.icon-rail` `.sidebar` `.year-wrap` `.year-menu` `.report-wrap` `.editable-cell` `.statut-chip` `.btn-icon` `.btn-allpaid` `.btn-delete` `.btn-confirm-yes` `.btn-confirm-no` `.drag-handle` `.th-mark` `.th-bulk-yes` `.th-bulk-no` `.chip-mois` `.chip-partiel`

**Data-attributes:** `data-view` `data-niveau` `data-classe` `data-student-id` `data-mois` `data-statut` `data-field` `data-rail-view` `data-rail-niveau` `data-rail-logout` `data-report-action` `data-annee`

**State classes toggled at runtime (must keep working, restyle their appearance freely):** `.active` `.open` `.nav-open` `.editing` `.dragging` `.drag-over` `.fading` `.row-confirm` `.row-deleting` `.row-highlight` `.row-retard` `.row-complet` `.chip-loading` `.show-flicker` `.nav-pinned` (on `<html>`)

If a redesign choice genuinely requires renaming one of these, you must update every reference in `js/app.js` and `js/render.js` in the same pass — never leave a dangling selector.

---

## DESIGN SYSTEM

### Direction

Light, airy, "Dribbble product shot" aesthetic: floating white cards on a soft cool-gray background, generous rounded corners, layered soft shadows, confident color used with intent rather than decoration. This is a daily-use operational tool for a private tutor — polished like a modern SaaS dashboard, not a marketing page. Replaces the current near-black theme entirely.

### Color tokens

Replace the `:root` block in `css/style.css` with:

```css
:root {
  /* Surfaces */
  --bg:              #F6F7FB;
  --surface:         #FFFFFF;
  --surface-sunken:  #F0F1F6;
  --surface-hover:   #FAFAFD;

  /* Borders */
  --border:          #E7E8F0;
  --border-mid:      #D8DAE6;
  --border-strong:   #C2C5D6;

  /* Ink */
  --ink-1:           #14151A;
  --ink-2:           #63636F;
  --ink-3:           #9C9CAA;
  --ink-inverse:     #FFFFFF;

  /* Accent — primary brand, neutral info */
  --accent:          #5B5FEF;
  --accent-hover:    #4A4EDB;
  --accent-soft:     #EEEEFD;
  --accent-ring:     rgba(91,95,239,0.35);

  /* Semantic — meaning is fixed across the whole app */
  --mint:            #17B26A;  --mint-soft:   #E7F9EF;  /* payé · ponctualité · succès */
  --coral:           #FF6B6B;  --coral-soft:  #FFECEC;  /* impayé · en retard · danger */
  --amber:           #F7A93A;  --amber-soft:  #FFF4E0;  /* partiel · à risque · caution */
  --orchid:          #B15CFF;  --orchid-soft: #F5EBFF;  /* paiements partiels (stat agrégée) */
  --sky:             #4C8DFF;  --sky-soft:    #EAF1FF;  /* séances — couleur additionnelle */
  --teal:            #12B8B0;  --teal-soft:   #E3FBF9;  /* séances — couleur additionnelle */

  /* Elevation — always layered, never a single flat shadow */
  --shadow-xs:    0 1px 2px rgba(20,21,26,0.04);
  --shadow-sm:    0 2px 8px rgba(20,21,26,0.06);
  --shadow-card:  0 1px 3px rgba(20,21,26,0.05), 0 12px 32px rgba(20,21,26,0.06);
  --shadow-md:    0 8px 24px rgba(20,21,26,0.10);
  --shadow-lg:    0 20px 56px rgba(20,21,26,0.16);
  --shadow-focus: 0 0 0 4px var(--accent-ring);

  /* Radius */
  --radius-xs:   8px;
  --radius-sm:   10px;
  --radius-md:   14px;
  --radius-lg:   20px;
  --radius-xl:   24px;
  --radius-full: 999px;

  /* Type */
  --font-display: 'Plus Jakarta Sans', -apple-system, sans-serif;
  --font-body:    'Inter', -apple-system, sans-serif;
}
```

**Semantic meaning is fixed everywhere it appears** — don't reinterpret a color per-component:

| Concept | Where it shows up | Token |
|---|---|---|
| Payé | statut chip, row-complet border | `--mint` |
| Impayé | statut chip | `--coral` |
| Partiel | statut chip, "Paiements partiels" stat | `--amber` for the chip |
| En retard (2+ mois consécutifs) | statut column flag, row-retard border, dashboard stat | `--coral` |
| À risque (1 mois impayé) | dashboard stat + alert table | `--amber` |
| Paiements partiels (compte agrégé) | dashboard stat icon only | `--orchid` — deliberately distinct from the per-cell amber so a *count metric* never looks like a *live status* |
| Ponctualité / élèves inscrits / mois en cours | dashboard stats | `--mint` (ponctualité), `--accent` (élèves inscrits, mois en cours) |
| Séances (calendar) | event blocks | any of `--sky` `--mint` `--coral` `--amber` `--orchid` `--teal` — same 6-token palette, nothing outside it |

### Typography

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Replace the current Inter+JetBrains Mono link in `index.html`, `app.html`, and `calendar.html` with the above. Drop JetBrains Mono entirely — use Inter with `font-variant-numeric: tabular-nums` for every number, phone, date, and time so digits never jitter in width. Exactly two families, used with a clear division of labor:

| Element | Face | Weight | Size |
|---|---|---|---|
| Wordmark "SLAH Academy" | Plus Jakarta Sans | 700 | 16px |
| Page titles (`<h1>`, dashboard/classe headers) | Plus Jakarta Sans | 700 | 24px |
| Stat card values | Plus Jakarta Sans | 700 | 28px |
| Modal / panel titles | Plus Jakarta Sans | 600 | 17px |
| Day-of-week, sidebar section labels | Inter | 600 | 11px, uppercase, 0.06em tracking |
| Table headers | Inter | 600 | 11px, uppercase, `--ink-3` |
| Table cell text, nav items, buttons | Inter | 500 | 13px |
| Phone numbers, dates, counts | Inter | 600 | 13px, tabular-nums |
| Body copy, subtitles | Inter | 400 | 13px, `--ink-2` |
| Empty states, placeholders | Inter | 500 | 12.5px, `--ink-3` |

### Motion

```css
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```
Hover lifts and menu entrances use `--ease-out`, 150–200ms. Anything that "snaps back" (a cancelled drag, a rejected drop) uses `--ease-spring` for a tactile overshoot. Respect `prefers-reduced-motion: reduce` globally — disable all transforms/transitions when set.

---

## GLOBAL COMPONENTS

Redefine these shared classes in `css/style.css` — every page inherits them.

### `.card`
```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-card);
padding: 20px 24px;
```

### `.btn` family
- `.btn-primary` — `--accent` fill, white text, `--radius-full` (pill), `--shadow-sm`, hover: `--accent-hover` + `--shadow-md` + `translateY(-1px)`
- `.btn-ghost` — transparent, `1px solid var(--border-mid)`, `--ink-2` text, `--radius-full`, hover: `--surface-sunken` fill
- `.btn-icon` — 32px circle, `--radius-full`, transparent default, hover: `--surface-sunken` fill (or `--coral-soft` fill + `--coral` icon for destructive icons like `.btn-delete`)
- All buttons: `font-family: var(--font-body); font-weight: 600; font-size: 13px;`

### Inputs
`--surface-sunken` background, no border by default, `--radius-sm`, 40px tall. On focus: background → `--surface`, `1px solid var(--accent)`, `box-shadow: var(--shadow-focus)`.

### Toasts (`showToast` in `js/render.js` — keep the function signature, restyle only the markup it injects)
Bottom-right, stacked. `--surface` card, `--radius-md`, `--shadow-lg`, 1px `--border`, small colored dot on the left edge (`--mint` for success/info, `--coral` for error). Slide in from `translateX(20px)` + fade, 200ms `--ease-out`. Auto-dismiss per existing timing.

### Empty states
Dashed 1.5px `--border-mid` circle or box, `--ink-3` icon/text, hover (where clickable) tints toward `--accent`. Success empty states (e.g. "Aucun retard") use `--mint` text on a `--mint-soft` pill instead of the dashed neutral treatment.

---

## LOGIN — `index.html`

Full-viewport, centered, `--bg` background. `.login-card` becomes a `.card`-style panel (per the global card spec above) at 380px width. Wordmark "SLAH Academy" in Plus Jakarta Sans 700 20px `--ink-1`, subtitle "Espace administration" in Inter 400 12px `--ink-3` beneath it, both centered above the card. Inputs and primary button follow the global component specs. `#loginError` — inline text in `--coral`, 12px, no icon, appears directly below the password field with 8px top margin, no layout shift (reserve the space or animate height in smoothly).

---

## APP SHELL — `app.html`

### Icon rail (`#iconRail`, collapsed state, 64px wide)

Floating, not flush to the viewport edge: `--surface` background, `--radius-lg` on its outer corners, `--shadow-card`, sits with 12px margin from the viewport edges (top/bottom/left), full height minus that margin.

- `.rail-logo` ("S") — 36px circle, `--accent` fill, white Plus Jakarta Sans 700 15px
- Dashboard rail item — 40px `--radius-md` square, `--ink-2` icon, hover `--surface-sunken`, `.active` state: `--accent-soft` fill + `--accent` icon
- Level items (`.rail-mono`, showing `7P` `8P` `9P` `1S` `2S` `3S` `BAC`) — same 40px `--radius-md` square treatment, Inter 700 11px letter codes, `.active` state identical accent treatment
- `.rail-flyout` (submenu of classes on hover/click) — floating card matching context-menu treatment: `--surface`, `--radius-lg`, `--shadow-lg`, 1px `--border`, appears just right of the rail item with an 8px gap, each class a `--radius-sm` row with `--surface-sunken` hover
- Logout rail item — same square treatment, hover tints toward `--coral-soft`/`--coral`

### Sidebar (`.sidebar`, expanded state)

`--surface` background, `--radius-lg` on outer corners, `--shadow-card`, same floating margin treatment as the rail (they're visually one unit when both visible — rail then sidebar, 8px gap between).

- `.sidebar-logo` — Plus Jakarta Sans 700 16px
- `.annee-badge` (year pill) — `--surface-sunken` background, `--radius-full`, Inter 600 12px, hover `--accent-soft` + `--accent` text
- `.year-menu` (dropdown) — floating card, same treatment as `.rail-flyout`
- `.nav-section` labels — Inter 600 10px uppercase 0.1em tracking `--ink-3`
- `.nav-level` (e.g. "📁 7ème Primaire") — Inter 600 11px `--ink-2`, not clickable, just a label — keep the emoji or replace with a small inline SVG folder glyph in `--ink-3`, your call, but keep it visually quiet
- `.nav-item.nav-classe` — `--radius-md` row, Inter 500 13px `--ink-2`, hover `--surface-sunken`, `.active`: `--accent-soft` fill + `--accent` text + `--accent` left border 2px
- `#navPinBtn` — small icon button matching `.btn-icon`
- Bottom: `#userEmail` in Inter 400 11px `--ink-3`, `#logoutBtn` as `.btn-ghost` sized down, full width

### Mobile drawer

`#navToggle` — floating circular button (44px, `--surface`, `--shadow-md`, `--radius-full`), fixed position, replacing whatever chrome it currently has. `#drawerBackdrop` — `rgba(20,21,26,0.35)` with `backdrop-filter: blur(6px)`. The sidebar itself becomes the drawer content sliding in from the left with the same card treatment, full height, `--radius-lg` on its trailing edge only.

### Loading overlay (`#loadingOverlay`)

`--bg` background at high opacity with `backdrop-filter: blur(4px)`, centered spinner: a simple 28px circular spinner using `--accent` as the active arc on a `--border` track (CSS-only, no image), `.loading-text` in Inter 500 13px `--ink-2` beneath it.

---

## DASHBOARD — `renderDashboard` in `js/render.js`

### Header
`h1` "Tableau de bord" — Plus Jakarta Sans 700 24px. Subtitle Inter 400 13px `--ink-3`. Right side: `.btn-ghost` for the "📅 Calendrier" link, year pill matching the sidebar's `.annee-badge` treatment.

### Stat grid (6 cards)
Responsive grid, `--card` treatment each, icon in a 40px `--radius-md` tinted square (using the token table above — `--accent-soft`/`--coral-soft`/`--amber-soft`/`--orchid-soft`/`--accent-soft`/`--mint-soft` for the six cards in order), stat label Inter 600 11px uppercase `--ink-3` next to the icon, big value in Plus Jakarta Sans 700 28px colored per its semantic token, footer text Inter 400 11px `--ink-3` below. On hover: `translateY(-2px)` + `--shadow-md` (same lift language as everything else).

### Three alert tables (`buildAlertTable` — "En retard", "À surveiller", "Paiements partiels")
Each inside a `.card` with a title row: emoji/icon + Inter 700 13px title + `.count-badge` (small pill, `--radius-full`, tinted per that table's semantic color — coral for retard, amber for risk, orchid for partiel, `--ink-1`-on-`--surface-sunken` if zero). Table rows use the same visual language as the classe-view student table (below) for consistency — `chip-mois` pills stay small rounded tags in the row's semantic color-soft background. Rows are clickable (existing behavior) — add a `--surface-hover` background + subtle `translateX(2px)` on hover to signal interactivity beyond just the cursor.

---

## CLASSE VIEW — `renderClasseView` in `js/render.js`

### Header
`h1` "{niveau} — {classe}" Plus Jakarta Sans 700 24px. Subtitle Inter 400 13px `--ink-3`. Right side, in order: `#btnBackDashboard` (`.btn-ghost`), `.report-wrap` (`#btnReport` as `.btn-ghost` with a small chevron, `#reportMenu` as a floating card matching `.rail-flyout` treatment with two `.report-item` rows), `#btnAddStudent` (`.btn-primary`).

### Search bar
Pill-shaped: `--surface-sunken` background, `--radius-full`, 40px tall, magnifying-glass SVG in `--ink-3` at the left, `#studentSearch` input transparent background inheriting the pill, `#searchClear` as a small `--ink-3` × that appears only when text is present, `#searchHint` (match count) in Inter 500 11px `--ink-3` at the right edge of the pill.

### Summary bar (`#summaryBar` / `renderSummaryBar`)
Four stats in a row, but lighter-weight than the dashboard's stat cards — no full card chassis, just `--surface` background strip with `--radius-lg`, `--shadow-xs`, divided by thin `1px --border` verticals between the four items. Values in Plus Jakarta Sans 700 20px, colored: payés→`--mint`, impayés→`--coral`, en retard→`--coral`, mois actuel→`--accent`.

### Student table (`#studentTable`)
Wrapped in `.table-wrap` inside a `.card`. Column-by-column:

- **`#`** — Inter 600 12px `--ink-3`, tabular-nums, 36px wide
- **Nom complet / Contact** (`.editable-cell`) — Inter 500 13px `--ink-1` for name, Inter 500 13px `--ink-2` tabular-nums for contact. On hover show a subtle dotted underline in `--border-strong` as the "double-click to edit" affordance (replacing whatever hint exists now). `.editing` state: cell background `--accent-soft`, `1px solid var(--accent)` inset.
- **WhatsApp** — `.btn-icon` circle, `--mint-soft` background with a WhatsApp-glyph SVG in `--mint` (swap the emoji for a proper inline SVG mark if straightforward; otherwise keep 💬 but still give it the tinted circle treatment)
- **10 month columns** — each `.statut-chip` becomes a 30×30px `--radius-sm` chip:
  - empty (`''`): `--surface-sunken` background, `1px dashed var(--border-mid)`, no glyph or a faint `·`
  - `.statut-paye`: `--mint-soft` background, `--mint` glyph/text (✓)
  - `.statut-impaye`: `--coral-soft` background, `--coral` glyph (✗)
  - `.statut-partiel`: `--amber-soft` background, `--amber` glyph (~)
  - hover: `translateY(-1px)` + `--shadow-xs`
  - `.chip-loading`: reduce opacity to 50%, show a tiny inline spinner instead of the glyph
  - `.th-mark` (header bulk-mark button, appears on `<th>` hover) — small circular `--accent-soft`/`--accent` button, opacity 0→1 on column-header hover
- **Note** (`.editable-cell[data-field="note"]`) — Inter 400 12px `--ink-2` italic when empty-placeholder, normal when filled; small 📝 replaced by a subtle note-glyph SVG in `--ink-3`, shown only when a note exists
- **Payés** (`.payes-count`) — pill: `--radius-full`, Inter 700 12px tabular-nums, `--mint-soft`/`--mint` when 10/10, `--coral-soft`/`--coral` when <5, `--surface-sunken`/`--ink-2` otherwise
- **Retard** — empty by default; `.has-retard` shows a small `--coral-soft` filled circle with a warning glyph in `--coral`
- **Actions** (opacity 0→1 on `tr:hover`) — `.btn-allpaid` (✅) as `.btn-icon` tinted `--mint-soft`/`--mint` on hover, `.btn-delete` (🗑️) as `.btn-icon` tinted `--coral-soft`/`--coral` on hover, `.drag-handle` (↕️) as a plain `--ink-3` grip icon, cursor `grab`

**Row states:** default `--surface`; hover `--surface-hover`; `.row-retard` gets a 3px `--coral` left border + very faint `--coral-soft` wash; `.row-complet` gets a 3px `--mint` left border; `.dragging` drops to 40% opacity; `.drag-over` shows a `--accent` dashed top border on the target row; `.row-confirm` (inline delete confirmation) swaps the row's action cell content to "Supprimer ?" text + small `.btn-confirm-yes` (`--coral` filled pill) / `.btn-confirm-no` (ghost pill) — style consistent with the rest of the confirm patterns in the app.

### Add panel (`#addPanel`, `renderAddPanel`)
Slides open as an inline `.card`-style panel directly under the header (not a modal — preserve existing inline behavior). Fields follow the global input spec, laid out in a row on desktop (Numéro narrow, Nom complet flexible, Contact parent flexible), stacking on mobile. `#btnAddSubmit` `.btn-primary`, `#btnAddCancel` `.btn-ghost`, `#addError` inline `--coral` text beneath the fields.

---

## CALENDAR — `calendar.html`

This page embeds FullCalendar v5 via CDN — keep the library, retheme its CSS overrides completely to match the new system, and restyle the surrounding chrome (topbar, quick-add, event editor popup).

### Page chrome
`--bg` background. `.topbar` becomes a flex row with the "← Retour" link styled as `.btn-ghost`, and `.add-event-form` (quick-add title input + button) styled per the global input/button specs, right-aligned or centered per available width.

### The calendar itself
`#calendar` wrapped in the same floating-card treatment as everything else: `--surface`, `--radius-xl`, `--shadow-card`, comfortable inner padding (12–16px) instead of the current 6px.

### FullCalendar overrides — replace the existing dark `.fc-*` rules with:
```css
.fc-theme-standard td, .fc-theme-standard th { border-color: var(--border); }
.fc-theme-standard .fc-scrollgrid { border-color: var(--border); border-radius: var(--radius-md); overflow: hidden; }
.fc-toolbar-title { font-family: var(--font-display); font-size: 18px !important; font-weight: 700 !important; color: var(--ink-1); }
.fc-col-header-cell-cushion { font-family: var(--font-body); color: var(--ink-3); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
.fc-daygrid-day-number { font-family: var(--font-body); color: var(--ink-2); font-size: 12px; font-weight: 600; }
.fc-timegrid-slot-label-cushion { color: var(--ink-3); font-family: var(--font-body); font-size: 11px; font-variant-numeric: tabular-nums; }
.fc-timegrid-slot-minor { border-top-style: dashed; border-color: var(--border); opacity: 0.6; }
.fc-day-today { background: var(--accent-soft) !important; }
.fc-highlight { background: var(--accent-soft); opacity: 0.7; }
.fc-timegrid-now-indicator-line { border-color: var(--coral); border-width: 2px 0 0; }
.fc-timegrid-now-indicator-arrow { border-color: var(--coral); }

.fc .fc-button {
  background: var(--surface-sunken);
  border: none;
  border-radius: var(--radius-full);
  color: var(--ink-2);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  box-shadow: none !important;
  padding: 8px 14px;
  transition: background-color 160ms var(--ease-out), color 160ms var(--ease-out);
}
.fc .fc-button:hover { background: var(--border-mid); color: var(--ink-1); }
.fc .fc-button-primary:not(:disabled).fc-button-active {
  background: var(--accent); color: #fff;
}
.fc-event { border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 12px; border-width: 0; }
```

### Event color palette
Replace whatever hex list currently backs `PALETTE`/swatches with exactly the six semantic event tokens: `--sky` `--mint` `--coral` `--amber` `--orchid` `--teal` (full-saturation values, used as FullCalendar `backgroundColor`/`borderColor` — text color white except on `--amber` where dark `--ink-1` text is needed for contrast, matching the existing `eventTextColor` logic already in the code — keep that function, just point it at the new hex values).

### Event editor popup (`.event-editor`)
Same floating-card treatment as the modal pattern used elsewhere: `--surface`, `--radius-lg`, `--shadow-lg`, no visible border (shadow alone defines the edge). `.swatch` becomes a 26px filled circle (up from whatever radius it has now) in each palette color, `.sel` state gets a `--ink-1` ring offset (`box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink-1)`) instead of a border-color change. `#editorTitle` and other inputs follow the global input spec. `#editorSave` `.btn-primary`, `#editorCancel` `.btn-ghost`, `#editorDelete` a `.btn-icon` tinted `--coral-soft`/`--coral`. `.editor-error` in `--coral` 12px.

### Toast (shared pattern)
Same treatment as the app's toast component described above.

---

## What NOT to do

- Do not touch `js/db.js`, `js/auth.js`, `js/compute.js`, or any Supabase call, RLS assumption, CSV/print/export logic, or hash-routing logic
- Do not rename or remove anything in the Preservation Contract without updating every JS reference in the same pass
- Do not revert to a dark theme anywhere — this redesign is intentionally, consistently light
- Do not introduce a third typeface or reintroduce a monospace face — Plus Jakarta Sans (display) + Inter (everything else) only
- Do not use flat single-value box-shadows — always the layered `--shadow-*` tokens
- Do not reassign a semantic color to a different meaning than the table above — mint always means paid/positive, coral always means unpaid/urgent, amber always means partial/caution
- Do not remove FullCalendar and rebuild the calendar from scratch — retheme it in place
- Do not add a UI framework, bundler, or npm dependency — CDN links only, same constraint as the rest of the repo
- Do not use `alert()`, `confirm()`, or `prompt()` — the app already avoids these; keep it that way
- Do not change the French copy/labels anywhere unless a token is objectively wrong

---

## Acceptance checklist

- Every ID, class, and data-attribute in the Preservation Contract still exists and still means what it meant before
- Login, add student, edit inline, delete with confirm, drag-to-reorder, month-chip cycling, bulk "mark month paid," "mark all paid," search/filter, CSV export, print report, year switching, hash-based deep links, and the icon-rail pin/flyout all still function exactly as before
- The whole app — login, dashboard, classe view, calendar — reads as one consistent light design system, not three different reskins
- Payé/mint, impayé/coral, partiel/amber, en-retard/coral, à-risque/amber, paiements-partiels/orchid are visually consistent everywhere those concepts appear
- Only Plus Jakarta Sans and Inter are loaded and used; no monospace face remains
- Every shadow is a layered token, every corner uses the radius scale, nothing is a sharp 0px rectangle except where explicitly noted
- The calendar page visually belongs to the same product as the rest of the app, with FullCalendar fully retheme'd, not left in its default or dark styling
- `prefers-reduced-motion: reduce` disables every transform/transition across all three pages
- Focus states are visible everywhere via `--shadow-focus`, never removed
- The app is still fully usable at mobile widths — icon rail collapses into the hamburger/drawer pattern exactly as it does today, just restyled
