# SLAH Academy — Claude Code Build Spec
# Paste this entire file into Claude Code to build the project

---

## What you are building

A private password-protected web app for a private teacher (SLAH Academy) to track monthly student payments across 7 levels and multiple classes. Built with plain HTML/CSS/JS, Supabase for auth and database, deployed on Vercel via GitHub. No React, no build step beyond what Vercel handles natively.

---

## Project structure to create

```
slah-academy/
├── index.html          ← login page
├── app.html            ← main app (protected, redirects to login if not authed)
├── css/
│   └── style.css       ← all styles
├── js/
│   ├── auth.js         ← supabase auth logic
│   ├── db.js           ← all supabase database calls
│   ├── compute.js      ← pure JS functions (no DB calls)
│   ├── render.js       ← all DOM rendering
│   └── app.js          ← entry point, wires everything together
├── .env.example        ← template for env vars (never commit real keys)
├── vercel.json         ← vercel config
└── README.md           ← setup instructions
```

---

## Environment variables

Never hardcode Supabase keys. 

**Locally**: Create a `config.local.js` file (gitignored) at the root:
```js
// config.local.js — never commit this file
const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here'
};
```

Include `config.local.js` in `app.html` and `index.html` via script tag BEFORE loading supabase.js:
```html
<script src="config.local.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**On Vercel**: Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard. Add a build script that injects them into `config.js`:
```json
{
  "buildCommand": "echo 'const CONFIG = { SUPABASE_URL: \"'$SUPABASE_URL'\", SUPABASE_ANON_KEY: \"'$SUPABASE_ANON_KEY'\" };' > config.js"
}
```

The `.env.example` file shows what keys are needed. Never commit real keys or `config.local.js` to GitHub.

---

## Supabase setup

### Authentication

Use Supabase Auth with email + password. Only one teacher account exists. The teacher logs in via `index.html`. On successful login, Supabase returns a session token stored automatically in localStorage by the Supabase JS client. Every page load on `app.html` checks for a valid session — if none, redirect to `index.html` immediately before rendering anything.

Use the Supabase JS client v2 loaded via CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

Auth flow:
- `index.html` → teacher enters email + password → `supabase.auth.signInWithPassword()` → on success redirect to `app.html`
- `app.html` on load → `supabase.auth.getSession()` → if no session, `window.location.href = 'index.html'`
- Logout button → `supabase.auth.signOut()` → redirect to `index.html`
- Show meaningful error messages on login failure: "Email ou mot de passe incorrect." Never expose raw Supabase error strings to the UI.

### Database tables

Create these tables in Supabase SQL editor exactly as written.

**Table: students**
```sql
create table students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nom_complet text not null,
  contact_parent text,
  niveau text not null,
  classe text not null,
  annee_scolaire text not null default '2024-2025',
  numero integer,
  user_id uuid references auth.users(id) on delete cascade
);

alter table students enable row level security;

create policy "Users can only access their own students"
on students for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

**Table: paiements**
```sql
create table paiements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  student_id uuid references students(id) on delete cascade,
  mois text not null check (mois in ('aout','septembre','octobre','novembre','decembre','janvier','fevrier','mars','avril','mai')),
  statut text not null check (statut in ('paye','impaye','partiel')),
  user_id uuid references auth.users(id) on delete cascade,
  unique(student_id, mois)
);

alter table paiements enable row level security;

create policy "Users can only access their own paiements"
on paiements for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

Row Level Security ensures that even with a leaked anon key, no one can read or write another user's data.

### db.js — all database functions

Write these functions in `db.js`. Every function is async and returns data or throws a typed error. Never let raw Supabase errors bubble to the UI.

```js
// Returns all students for a given niveau + classe + annee_scolaire
async function getStudents(niveau, classe, anneeScolaire)

// Returns all paiements for a list of student IDs
async function getPaiements(studentIds)

// Returns all students + their paiements for a given niveau + classe
// Joins both tables, returns array of enriched student objects
async function getClasseData(niveau, classe, anneeScolaire)

// Adds a new student
async function addStudent({ nomComplet, contactParent, niveau, classe, anneeScolaire, numero })

// Updates student nom or contact
async function updateStudent(id, fields)

// Deletes a student and all their paiements (cascade handles paiements)
async function deleteStudent(id)

// Sets or updates a payment status. Uses upsert on (student_id, mois)
async function setPaiement(studentId, mois, statut)

// Removes a payment row (reverts to empty/unmarked)
async function deletePaiement(studentId, mois)

// Returns all students across all classes with at least one 'impaye' 
// in two consecutive months — used by the dashboard
async function getLateStudents(anneeScolaire)

// Returns dashboard statistics for the school year
// Returns object: { totalStudents, paidThisMonth, unpaidCount, onTimeRate }
// paidThisMonth: count of students with 'paye' status in the latest month that has any data
// unpaidCount: count of students with at least one 'impaye' month
// onTimeRate: (paidThisMonth / totalStudents) * 100, rounded to nearest integer
async function getStats(anneeScolaire)
```

Each function wraps its Supabase call in try/catch. On error, log to console and throw a clean French error string: `"Erreur lors du chargement des élèves."` etc.

---

## compute.js — pure functions, no DB calls

These functions receive plain JS objects and return computed values. They never touch the DOM or Supabase. They can be tested independently.

```js
// Returns count of months with statut 'paye'
function moisPayes(paiementsObj) 
// paiementsObj = { aout: 'paye', septembre: 'impaye', ... }
// returns number 0-10

// Returns count of months with no entry (empty)
function moisManquants(paiementsObj)
// returns number 0-10

// Returns true if 2 or more consecutive months are 'impaye'
// Months are ordered: aout, septembre, octobre, novembre, decembre,
// janvier, fevrier, mars, avril, mai
// Checks each consecutive pair in that order
function hasRetard(paiementsObj)
// returns boolean

// Returns WhatsApp link from a phone number string
// Strips spaces, dashes, parentheses. Handles +216 prefix.
function whatsappLink(tel)
// returns string: "https://wa.me/216XXXXXXXX" or "" if tel is empty

// Returns display label for a month key
function moisLabel(moisKey)
// 'aout' → 'Août', 'septembre' → 'Septembre', etc.

// Returns next statut in the cycle when a month cell is clicked
// '' → 'paye' → 'impaye' → 'partiel' → ''
function nextStatut(currentStatut)

// Returns CSS class for a statut value
// 'paye' → 'statut-paye', 'impaye' → 'statut-impaye', 
// 'partiel' → 'statut-partiel', '' → 'statut-vide'
function statutClass(statut)

// Returns display glyph for a statut
// 'paye' → '✓', 'impaye' → '✗', 'partiel' → '~', '' → '·'
function statutGlyph(statut)
```

---

## Data structure in memory

After `getClasseData()` returns, build this enriched object in memory before rendering:

```js
// One student object in memory
{
  id: 'uuid',
  nomComplet: 'Ahmed Ben Salah',
  contactParent: '+216 55 123 456',
  niveau: '7ème Primaire',
  classe: 'Classe A',
  anneeScolaire: '2024-2025',
  numero: 1,
  // paiements keyed by mois
  paiements: {
    aout: 'paye',
    septembre: 'impaye',
    octobre: '',        // empty = not yet set
    novembre: '',
    decembre: '',
    janvier: '',
    fevrier: '',
    mars: '',
    avril: '',
    mai: ''
  },
  // computed at render time, not stored
  computed: {
    moisPayes: 2,
    moisManquants: 8,
    hasRetard: false,
    whatsapp: 'https://wa.me/21655123456'
  }
}
```

Build `computed` by calling the functions from `compute.js` before passing the object to any render function. Never store computed values in the database.

---

## Visual design

Dark, professional, no-nonsense. This is a tool, not a landing page. Design for a teacher who opens it on a laptop every morning.

**Color tokens (CSS variables in `:root`)**
```css
--bg: #0F0F0F;
--surface: #1A1A1A;
--surface-2: #222222;
--border: rgba(255,255,255,0.08);
--border-strong: rgba(255,255,255,0.14);
--text-primary: #F0EEE9;
--text-secondary: #9E9C97;
--text-tertiary: #5A5855;
--paye: #4ADE80;
--paye-bg: rgba(74,222,128,0.10);
--impaye: #F87171;
--impaye-bg: rgba(248,113,113,0.10);
--partiel: #FBBF24;
--partiel-bg: rgba(251,191,36,0.10);
--accent: #3B82F6;
--accent-bg: rgba(59,130,246,0.10);
--retard: #F97316;
--retard-bg: rgba(249,115,22,0.10);
```

**Typography**
```css
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
```
Load Inter and JetBrains Mono from Google Fonts in the `<head>`.

**Layout**
- Body: `--bg` background, `--font-body`, `--text-primary`
- App shell: fixed sidebar left (240px wide) + scrollable main content right
- Sidebar: `--surface` background, `--border` right border
- Main: padding 32px, max-width 1100px, scrollable independently

**Card chassis**
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px 24px;
}
```

No shadows. Clean flat borders only. No rounded corners above 12px anywhere.

---

## index.html — login page

Full-page centered login form. Dark background `--bg`. Logo/wordmark at top: `SLAH Academy` in `--text-primary`, 24px, weight 700. Below it: `Espace administration` in `--text-tertiary`, 13px.

Form card (max-width 360px, centered):
- Input: Email address — label `Adresse email`, type email, autocomplete email
- Input: Password — label `Mot de passe`, type password, autocomplete current-password
- Button: `Se connecter` — full width, `--accent` background, white text, 13px weight 600
- Error zone: `<div id="loginError">` — hidden by default, shown in `--impaye` color on auth failure

On submit: disable the button, show `Connexion…` text, call `supabase.auth.signInWithPassword()`. On success: `window.location.href = 'app.html'`. On error: re-enable button, show French error message in error zone.

On page load: if already authenticated, redirect straight to `app.html`.

---

## app.html — main application

### Auth guard (first thing in the script)
```js
const { data: { session } } = await supabase.auth.getSession();
if (!session) window.location.href = 'index.html';
```
This runs before any rendering. Nothing renders until auth is confirmed.

### Sidebar

Fixed left, 240px wide, full height, `--surface` background.

Top section:
- Logo: `SLAH Academy` 15px weight 700
- School year badge: `2024–2025` — small pill, `--accent-bg` background, `--accent` text, 11px mono

Navigation — grouped:
```
── Vue d'ensemble
   📊 Tableau de bord

── Niveaux
   📁 7ème Primaire
      └ Classe A
      └ Classe B
   📁 8ème Primaire
      └ Classe A
      └ Classe B
   📁 9ème Primaire
      └ Classe A
      └ Classe B
   📁 1ère Secondaire
      └ Classe A
      └ Classe B
   📁 2ème Secondaire
      └ Maths
      └ Physique
      └ Sciences
   📁 3ème Secondaire
      └ Maths
      └ Physique
      └ Sciences
   📁 Bac
      └ Maths
      └ Physique
      └ Sciences
```

Each class link is a `<button>` or `<a>` with `data-niveau` and `data-classe` attributes. Clicking it calls `navigateTo(niveau, classe)`. Active state: `--accent-bg` background, `--accent` left border 2px, `--text-primary` text.

Level headers are not clickable — just labels with `--text-tertiary` color, 10px uppercase, 0.1em tracking.

Bottom of sidebar:
- Teacher email in `--text-tertiary` 11px
- `Se déconnecter` button — text only, `--text-tertiary`, hover `--impaye`

### Main content area

Renders one view at a time based on navigation state. Two views: Dashboard and Classe view.

---

## Dashboard view

Shown when "Tableau de bord" is clicked. Reads from `getLateStudents()`.

**Header**
```
Tableau de bord          [Année: 2024–2025 ▾]
Suivi des paiements — SLAH Academy
```

**Stats row** — 3 cards side by side:
- Total élèves (count of all students in DB for current year)
- Paiements en retard (count of students where `hasRetard = true`)
- Mois en cours (current month label — auto-detected from `new Date()`)

**Late payments table**
Title: `⚠️ Élèves en retard de paiement`

Table columns: Niveau · Classe · Élève · Contact · Mois impayés · Action

Each row is a student with `hasRetard = true`. The "Mois impayés" column lists which consecutive months are unpaid as small red chips. The "Action" column has a WhatsApp icon button that opens `whatsappLink(contact)` in a new tab.

If no late students: empty state — `✓ Aucun retard de paiement détecté.` in `--paye` color, centered, 14px.

---

## Classe view

Shown when a class is clicked in the sidebar. Calls `getClasseData(niveau, classe, anneeScolaire)`, builds enriched student objects, calls `renderClasseView()`.

### Header row
```
7ème Primaire — Classe A                    [+ Ajouter un élève]
24 élèves · Année 2024–2025
```

### Summary bar
4 stats in a single row below the header:
- Payés ce mois: count where current month = 'paye'
- Impayés ce mois: count where current month = 'impaye'
- En retard: count where `hasRetard = true` (shown in `--retard` color)
- Mois actuel: current month label (auto from `new Date()`, mapped to month key)

### Student table

One `<table>` with these columns in order:

| # | Nom complet | Contact | WhatsApp | Août | Sep | Oct | Nov | Déc | Jan | Fév | Mar | Avr | Mai | Payés | Retard | Actions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

**Column details:**

`#` — student's `numero`, 40px wide, `--text-tertiary`, mono

`Nom complet` — `--text-primary`, weight 500. Click to edit inline: double-click turns the cell into a `contenteditable` span. Press Enter or blur to save via `updateStudent()`. Press Escape to cancel. Show a subtle underline on hover to hint editability.

`Contact` — phone number, `--text-secondary`, mono, 13px. Same inline-edit behavior on double-click.

`WhatsApp` — icon button only. Opens `whatsappLink(contact)` in new tab. Icon: 💬. Hidden if contact is empty.

`Août` through `Mai` — 10 month columns. Each cell is a small clickable chip:
- Width: 44px
- Height: 30px
- Border-radius: 6px
- Font: 12px mono weight 600

Statut states and their appearance:
```
'' (vide)    → background: transparent, border: 1px solid --border, 
               text: '·' in --text-tertiary
'paye'       → background: --paye-bg, border: 1px solid --paye (20% opacity),
               text: '✓' in --paye
'impaye'     → background: --impaye-bg, border: 1px solid --impaye (20% opacity),
               text: '✗' in --impaye  
'partiel'    → background: --partiel-bg, border: 1px solid --partiel (20% opacity),
               text: '~' in --partiel
```

**On click:** call `nextStatut(current)` → if result is `''` call `deletePaiement()`, else call `setPaiement()`. Show a loading state on the cell (spinner or dim) while the DB call is in flight. On success re-render only that cell — do not re-render the entire table. On error show a brief toast: `"Erreur — réessayez."`.

**Optimistic update:** update the cell UI immediately on click, then sync to DB. If DB call fails, revert the cell and show the toast.

`Payés` — calls `moisPayes(student.paiements)`. Shown as `N/10` in mono. Color: green if N=10, orange if N<5, default otherwise.

`Retard` — calls `hasRetard(student.paiements)`. Shows `⚠️` in `--retard` if true, empty if false. Cell has `--retard-bg` background when active.

`Actions` — appears on row hover only (opacity 0 → 1 on `tr:hover`). Two icon buttons:
- 🗑️ Delete — click shows inline confirm: row background turns `--impaye-bg`, text changes to `"Supprimer ?" [Oui] [Non]`. On Oui: call `deleteStudent(id)`, remove row from DOM. On Non: restore row.
- ↕️ Reorder — drag handle. Wire HTML5 drag/drop on rows. Visual feedback: dragged row becomes semi-transparent. On drop: 
  - Calculate new positions for affected students
  - Call `updateStudent(id, { numero: newPosition })` for each affected row
  - Re-render affected rows only (or full table if easier)
  - Show loading state while updating
  - On error: revert all rows to previous order and show toast

**Row states:**
- Default: `--surface` background
- Hover: `--surface-2` background, Actions column fades in
- `hasRetard = true`: left border `3px solid --retard`, `--retard-bg` background at 40% (very subtle)
- All months paid: left border `3px solid --paye`

### Add student panel

Shown by clicking `+ Ajouter un élève` button in the header. Slides down as an inline panel above the table (not a modal).

Fields:
- Numéro (number input, pre-filled with max existing numero in this class + 1. If no students yet, defaults to 1)
- Nom complet (text, required)
- Contact parent (tel input, optional)

Buttons: `Ajouter` (primary) · `Annuler` (ghost)

On submit: validate nom is not empty, call `addStudent()`, close panel, append new row to table without full re-render. On error: show inline error below the form.

---

## Dashboard view details

The dashboard is the home screen. It displays:
- **Stats bar** at the top showing: total students, students with payment issues, on-time rate percentage
- **Late payment alert table** showing all students with 2+ consecutive unpaid months across all classes. Columns: Student name, Class, Level, Latest unpaid month. If no late payments, show empty state: "Tous les élèves sont à jour ✓"
- Clicking a row navigates to that classe view with that student highlighted

---

## render.js — rendering functions

Write these functions. Each receives data objects, returns DOM elements or mutates specific existing DOM nodes. No function re-renders more than what it needs to.

```js
// Renders the full sidebar navigation. Called once on load.
function renderSidebar(activeNiveau, activeClasse)

// Renders the dashboard view into #mainContent
// lateStudents: array of enriched student objects with retard flag
// stats: object with { totalStudents, paidThisMonth, unpaidCount, onTimeRate }
function renderDashboard(lateStudents, stats)

// Renders a full classe view into #mainContent
// Includes sidebar, header with add button, summary bar, and student table
// Calculate nextNumero from students before rendering add panel
function renderClasseView(niveau, classe, students)

// Renders a single table row for one student
function renderStudentRow(student)

// Updates a single month cell in place (no table re-render)
// Used for optimistic updates
function updateCell(studentId, mois, statut)

// Renders the summary bar for a classe view
function renderSummaryBar(students)

// Renders a toast notification (auto-dismisses after 3s)
// type: 'success' | 'error' | 'info'
function showToast(message, type)

// Renders the add-student panel
// nextNumero is calculated as: max(students.map(s => s.numero)) + 1 or 1 if no students
function renderAddPanel(niveau, classe, nextNumero)

// Renders an empty state inside a container
function renderEmptyState(container, message)
```

---

## app.js — entry point and navigation

```js
// State
let currentView = 'dashboard'; // 'dashboard' | 'classe'
let currentNiveau = null;
let currentClasse = null;
const ANNEE = '2024-2025'; // Update this each school year

// Structure definition — single source of truth for all levels and classes
const STRUCTURE = [
  { niveau: '7ème Primaire',     classes: ['Classe A', 'Classe B'] },
  { niveau: '8ème Primaire',     classes: ['Classe A', 'Classe B'] },
  { niveau: '9ème Primaire',     classes: ['Classe A', 'Classe B'] },
  { niveau: '1ère Secondaire',   classes: ['Classe A', 'Classe B'] },
  { niveau: '2ème Secondaire',   classes: ['Maths', 'Physique', 'Sciences'] },
  { niveau: '3ème Secondaire',   classes: ['Maths', 'Physique', 'Sciences'] },
  { niveau: 'Bac',               classes: ['Maths', 'Physique', 'Sciences'] },
];

// Navigation
async function navigateTo(view, niveau = null, classe = null) {
  currentView = view;
  currentNiveau = niveau;
  currentClasse = classe;
  renderSidebar(niveau, classe);
  showLoadingState(); // dim main content, show spinner
  if (view === 'dashboard') {
    const [lateStudents, stats] = await Promise.all([
      getLateStudents(ANNEE),
      getStats(ANNEE)
    ]);
    renderDashboard(lateStudents, stats);
  } else if (view === 'classe') {
    const students = await getClasseData(niveau, classe, ANNEE);
    renderClasseView(niveau, classe, students);
  }
}

// Init
async function init() {
  // 1. Auth check
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  // 2. Render sidebar
  renderSidebar(null, null);

  // 3. Load dashboard by default
  await navigateTo('dashboard');
}

init();
```

---

## Error handling rules

Apply these rules everywhere without exception:

1. **Every DB call is wrapped in try/catch.** Never let an unhandled promise rejection reach the console without a user-facing message.

2. **Loading states on every async action.** Any button that triggers a DB call gets `disabled = true` and shows a spinner or `…` text while the call is in flight. Re-enable on completion (success or error).

3. **Optimistic updates on month cells only.** For the frequent action of clicking a month cell, update the UI immediately and sync to DB in background. All other DB actions wait for confirmation before updating UI.

4. **No silent failures.** If a DB call fails, always show a toast. Never just log to console and move on.

5. **Empty states everywhere.** Every list or table that can be empty has an explicit empty state message. Never render an empty `<table>` or `<ul>`.

6. **No data loss on error.** If `updateStudent` fails, revert the inline edit to the previous value. If `setPaiement` fails, revert the cell to its previous statut.

7. **Session expiry handling.** On any Supabase call that returns a 401/403, redirect to `index.html` immediately.

---

## vercel.json

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

Note: No rewrites needed. Vercel serves .html files as-is.

---

## README.md — setup instructions

Write a README that covers exactly:

1. Clone the repo
2. Create a Supabase project, run the two SQL table creation scripts
3. Create the teacher account in Supabase Auth dashboard (email + password)
4. Copy `.env.example` to `config.local.js`, fill in SUPABASE_URL and SUPABASE_ANON_KEY
5. Open `index.html` locally to test (or use VS Code Live Server)
6. Push to GitHub
7. Connect GitHub repo to Vercel
8. Add SUPABASE_URL and SUPABASE_ANON_KEY as environment variables in Vercel dashboard
9. Deploy

---

## What NOT to do

- Do not use React, Vue, or any frontend framework
- Do not use a bundler (no webpack, no vite, no parcel)
- Do not import npm packages — use CDN links only
- Do not store computed values (moisPayes, hasRetard, whatsapp) in the database
- Do not re-render the full table on every cell click — update only the affected cell
- Do not expose raw Supabase error messages to the UI — always translate to French
- Do not commit `.env` files, `config.local.js`, or real API keys to GitHub. Add to `.gitignore`:
  ```
  config.local.js
  .env
  .env.local
  node_modules/
  ```
- Do not use `alert()` or `confirm()` for any UI — use inline UI patterns instead
- Do not add animations or transitions that delay user interaction
- Do not add features not listed in this spec

---

## Acceptance checklist

- Opening `index.html` shows the login form. Wrong credentials show a French error. Correct credentials redirect to `app.html`.
- Refreshing `app.html` without being logged in redirects to `index.html` immediately — no flash of content.
- Sidebar shows all 7 levels and their classes. Active class is highlighted.
- Dashboard loads and shows stats and the late-payment table. If no late payments, shows the success empty state.
- Clicking a class in the sidebar loads that class's student table with all 10 month columns.
- Clicking a month cell cycles through: empty → ✓ Payé → ✗ Impayé → ~ Partiel → empty. Change persists on refresh.
- The Payés column always shows the correct count. The Retard column shows ⚠️ for students with 2+ consecutive impayé months.
- Adding a student via the panel appends them to the table and DB.
- Deleting a student shows inline confirm, removes from DB and DOM on confirm.
- The WhatsApp button opens the correct wa.me link in a new tab.
- Double-clicking a student name or contact edits it inline. Enter saves, Escape cancels. Change persists on refresh.
- Dragging rows reorders them and persists the new order.
- All error states show a toast. No silent failures.
- `Se déconnecter` logs out and redirects to `index.html`.
- The app works on Chrome, Firefox, and Safari desktop.
