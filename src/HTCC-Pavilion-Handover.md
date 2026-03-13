# HTCC Pavilion — Project Handover
> Last updated: 13 March 2026 · Covers all development sessions to date

---

## 1. Project Identity

| Item | Value |
|---|---|
| App name | **Pavilion** |
| Club | Harrow Town Cricket Club (HTCC), Est. 1921 |
| Superadmin email | anish.vek10@gmail.com |
| Project root | `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-web\` |
| Dev server | `http://localhost:5173/` → run `npm run dev` |
| Live URL | `https://pavilion-htcc.netlify.app` |
| Supabase project ref | `nqhhvataxjaecctvrrzc` |
| Supabase email confirmation | OFF (re-enable before go-live) |

---

## 2. Tech Stack (Locked)

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 8 beta |
| Styling | TailwindCSS v4 + CSS custom properties |
| Routing | React Router v6 |
| State | Zustand (`authStore.js`) |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS + Realtime) |
| Hosting | Netlify (auto-deploy on `git push` to `main`) |

---

## 3. Club Structure & Roles

**Teams:** 1st XI, 2nd XI, 3rd XI, 4th XI, Sunday XI (5 teams seeded)
**Members:** 50–60; members can belong to multiple teams

**Role hierarchy (top → bottom):**
```
superadmin → admin → captain → member → pending
```
- Only **superadmin** can promote to admin
- **Admins** can promote up to captain only
- Enforced at UI layer (`getRoleOptions()`) AND server layer (`handleRoleChange` guard)

---

## 4. Design System (Locked)

```css
--navy:        #0D1B2A
--navy-mid:    #1A2F4A
--navy-card:   #162236
--gold:        #F5C518
--gold-muted:  #C9A227
--text-primary:#F8F9FA
--text-muted:  #8B9BB4
--green:       #22C55E
--red:         #EF4444
--amber:       #F5C518

/* Sunday fixture accent */
--blue-sunday: #60A5FA
```

**Fonts:**
- `Bebas Neue` — display / headings (`var(--font-display)`)
- `DM Sans` — body
- `JetBrains Mono` — stats / data

---

## 5. App Icon — FINAL ✅

**File:** `pavilion-web/public/assets/images/pavilion-icon.svg`
**Concept:** "The Eleven Shield" — 11 gold dots orbiting a heraldic shield; small X cross sits above the P inside the shield, acting as a pavilion roofline silhouette.

### Final SVG (deploy-ready, no XML comments)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
  <rect width="60" height="60" rx="14" fill="#0D1B2A"/>
  <rect x="1" y="1" width="58" height="58" rx="13" fill="none" stroke="#F5C518" stroke-width="1.6"/>
  <circle cx="30" cy="30" r="24" fill="none" stroke="#F5C518" stroke-width="0.5" stroke-opacity="0.18"/>
  <circle cx="30"    cy="6.5"  r="2.2" fill="#F5C518" fill-opacity="1.00"/>
  <circle cx="41.77" cy="9.8"  r="2.2" fill="#F5C518" fill-opacity="0.90"/>
  <circle cx="50.7"  cy="18.3" r="2.2" fill="#F5C518" fill-opacity="0.78"/>
  <circle cx="54"    cy="30"   r="2.2" fill="#F5C518" fill-opacity="0.65"/>
  <circle cx="50.7"  cy="41.7" r="2.2" fill="#F5C518" fill-opacity="0.53"/>
  <circle cx="41.77" cy="50.2" r="2.2" fill="#F5C518" fill-opacity="0.43"/>
  <circle cx="30"    cy="53.5" r="2.2" fill="#F5C518" fill-opacity="0.35"/>
  <circle cx="18.23" cy="50.2" r="2.2" fill="#F5C518" fill-opacity="0.43"/>
  <circle cx="9.3"   cy="41.7" r="2.2" fill="#F5C518" fill-opacity="0.53"/>
  <circle cx="6"     cy="30"   r="2.2" fill="#F5C518" fill-opacity="0.65"/>
  <circle cx="9.3"   cy="18.3" r="2.2" fill="#F5C518" fill-opacity="0.78"/>
  <path d="M30 12 L44 18 L44 33 Q44 46 30 51 Q16 46 16 33 L16 18 Z" fill="#1A2F4A" stroke="#F5C518" stroke-width="1.1"/>
  <line x1="24" y1="21" x2="36" y2="33" stroke="#F5C518" stroke-width="1.0" stroke-opacity="0.45" stroke-linecap="round"/>
  <line x1="36" y1="21" x2="24" y2="33" stroke="#F5C518" stroke-width="1.0" stroke-opacity="0.45" stroke-linecap="round"/>
  <text x="30" y="41" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="700" fill="#F5C518">P</text>
</svg>
```

### Icon design decisions
- 11 dots clockwise from top, fading opacity = squad depth metaphor
- Subtle guide circle ring behind dots (opacity 0.18)
- Gold outer border on navy tile
- Shield fill = `--navy-mid` (#1A2F4A) — reads as depth inside the ring
- Cross lines: 12×12 unit box centred at (30, 27), does NOT touch shield edges
- P baseline at y=41, visually centred below the cross — cross acts as pavilion roof over P
- **No 1921 text** — intentionally removed

### Files wired to this icon
```html
<!-- index.html -->
<link rel="icon" type="image/svg+xml" href="/assets/images/pavilion-icon.svg" />
<link rel="apple-touch-icon" href="/assets/images/pavilion-icon.svg" />
```
```jsx
// Navbar.jsx
<img src="/assets/images/pavilion-icon.svg" alt="Pavilion"
     style={{ height: '38px', width: '38px', borderRadius: '10px' }} />
```

---

## 6. Key File Map

```
pavilion-web/
├── netlify.toml
├── vite.config.js
├── public/
│   └── assets/images/
│       ├── htcc-logo.png                    ← original HTCC club crest (black bg PNG)
│       └── pavilion-icon.svg                ✅ FINAL app icon
├── src/
│   ├── styles/globals.css
│   ├── lib/
│   │   ├── supabase.js
│   │   └── constants.js                     ← PAGE_TITLES, ROUTES, ROLES, MATCH_TYPE_LABELS,
│   │                                           NOTIFICATION_TYPES
│   ├── store/
│   │   └── authStore.js                     ← Zustand auth; uses ROLES.SUPERADMIN
│   ├── components/layout/
│   │   ├── Navbar.jsx                       ✅ HTCC crest + NotificationBell; role-based links
│   │   ├── NotificationBell.jsx             ✅ NEW — bell icon, unread badge, dropdown,
│   │   │                                       real-time subscription
│   │   ├── AppShell.jsx
│   │   └── ProtectedRoute.jsx
│   └── pages/
│       ├── member/
│       │   ├── DashboardPage.jsx            ✅ weekly navigator + availability toggle-off
│       │   ├── FixturesPage.jsx             ✅ uppercase opponents, home/away badges
│       │   ├── FixtureDetailPage.jsx        ✅ availability toggle-off
│       │   ├── ProfilePage.jsx
│       │   ├── TeamsPage.jsx                ✅ join requests + cancel; HTCC crest on cards;
│       │   │                                   availability toggle-off
│       │   └── NotificationsPage.jsx        ✅ NEW — full notification centre (/notifications)
│       ├── captain/
│       │   ├── CaptainFixturesPage.jsx      ✅ 🔔 Remind button per fixture
│       │   └── SquadSelectionPage.jsx
│       └── admin/
│           ├── AdminDashboardPage.jsx       ✅ uppercase opponents, home/away badges
│           ├── AdminFixturesPage.jsx        ✅ 🔔 Remind button + home/away badges
│           ├── AdminMembersPage.jsx         ✅ Approve/Reject buttons (not dropdown)
│           ├── AdminMatchdayPage.jsx        ✅ home/away badges standardised
│           └── AdminAnnouncementsPage.jsx
```

---

## 7. Database Schema

**Tables in Supabase:**
`profiles` · `teams` · `team_members` · `join_requests` · `fixtures` · `availability` · `squads` · `squad_members` · `notifications` · `announcements`

> Note: `notifications_log` was renamed to `notifications` in the current schema.

### profiles columns (confirmed)
`id` · `full_name` · `phone` · `date_of_birth` · `avatar_url` · `role` · `expo_push_token` (null — reserved for Phase 3 mobile) · `created_at` · `updated_at` · `avatar_color`

### notifications table (NEW ✅)
```sql
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,   -- see NOTIFICATION_TYPES in constants.js
  title       text not null,
  body        text,
  fixture_id  uuid references public.fixtures(id) on delete set null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
```

### Supabase functions (security definer RPC)
| Function | Purpose |
|---|---|
| `send_fixture_reminder(p_fixture_id uuid)` | Inserts notifications for team members who haven't responded; returns count sent |
| `send_monday_reminders()` | Finds upcoming Sat/Sun fixtures, notifies non-responders; deduplicates (no repeat within 7 days) |

### pg_cron job
```sql
-- Fires every Monday at 09:00 UTC
select cron.schedule(
  'pavilion-monday-availability-reminder',
  '0 9 * * 1',
  $$select public.send_monday_reminders()$$
);
```

### Critical FK fix (already applied)
```sql
alter table join_requests drop constraint if exists join_requests_player_id_fkey;
alter table join_requests
  add constraint join_requests_player_id_fkey
  foreign key (player_id) references public.profiles(id) on delete cascade;
notify pgrst, 'reload schema';
```
> **Why:** PostgREST nested joins break when FK points to `auth.users` instead of `public.profiles`. This fix resolves the join; prior workaround was a two-step manual merge fetch.

### Realtime (enabled tables)
```sql
-- Required for NotificationBell live updates
alter publication supabase_realtime add table public.notifications;
```

### RLS policies in place

| Table | Policies |
|---|---|
| `profiles` | Admins can update member roles |
| `join_requests` | INSERT / SELECT (own + admin) / UPDATE / DELETE — all four operations |
| `fixtures` | Readable by all authenticated members |
| `availability` | INSERT / UPDATE / DELETE own records |
| `notifications` | SELECT / UPDATE / DELETE own records |

---

## 8. DashboardPage — Weekly Fixture Navigator

### State
```js
const [weekOffset, setWeekOffset] = useState(0)   // 0 = current week
```

### Week date helper
```js
const getWeekDates = (offset) => {
  const today = new Date()
  const day = today.getDay()
  const diffToSat = day === 6 ? 0 : (6 - day)
  const sat = new Date(today)
  sat.setDate(today.getDate() + diffToSat + offset * 7)
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  return {
    saturday: sat.toISOString().split('T')[0],
    sunday:   sun.toISOString().split('T')[0],
  }
}
```

### Fixture fetch (offset-aware)
```js
const fetchFixtures = async (offset = 0) => {
  const { saturday, sunday } = getWeekDates(offset)
  // .in('match_date', [saturday, sunday])
}
```

### Re-fetch on week change
```js
useEffect(() => {
  if (profile) fetchFixtures(weekOffset)
}, [weekOffset])
```

### Week label
```js
const weekLabel = (() => {
  const { saturday } = getWeekDates(weekOffset)
  const d = parseISO(saturday)
  if (weekOffset === 0)  return 'This Weekend'
  if (weekOffset === 1)  return 'Next Weekend'
  if (weekOffset === -1) return 'Last Weekend'
  return `w/c ${format(d, 'd MMM yyyy')}`
})()
```

### Render structure
- **Navigator bar:** `← Prev` | week label pill (click → jump to current) | `Next →` | `+ Add Fixture`
- **Saturday section:** gold header pill + full date, `THIS WEEKEND` badge if offset=0
  - 4 cards → 2×2 grid; 1–3 → auto columns
  - Cards: gold top border + gradient
- **Sunday section:** blue (`#60A5FA`) header pill + full date, single-column (max 600px)
  - Cards: blue top border + gradient
- **Empty states:** per section — "No Saturday/Sunday fixtures scheduled for this week"

### Derived values
```js
const { saturday: satDate, sunday: sunDate } = getWeekDates(weekOffset)
const satFixtures = fixtures.filter(f => f.match_date === satDate)
const sunFixtures = fixtures.filter(f => f.match_date === sunDate)
```

> Old `sortedDates` / `fixturesByDate` grouping logic has been fully removed.

---

## 9. Availability — Toggle-Off Behaviour ✅

Members can **deselect** their current availability by clicking the already-active button. This deletes the record from Supabase and resets to "no response" — useful when a member is unsure and does not want to submit a misleading status.

**Pattern applied in:** `DashboardPage.jsx`, `TeamsPage.jsx`, `FixtureDetailPage.jsx`

```js
// Pseudocode — same logic in all three files
if (existing === status) {
  // Toggle off → DELETE the record
  await supabase.from('availability').delete()
    .eq('fixture_id', fixtureId).eq('player_id', profile.id)
  clearAvailabilityFromState(fixtureId)
  toast('Availability cleared', { icon: '↩️' })
} else if (existing) {
  // Switch status → UPDATE
} else {
  // First response → INSERT
}
```

> **RLS note:** Requires a `DELETE` policy on `availability` — applied in Supabase SQL Editor.

---

## 10. Notification System ✅

### NotificationBell.jsx (`src/components/layout/NotificationBell.jsx`)
- Bell icon with live red badge showing unread count
- Dropdown shows latest 8 notifications with timestamps
- **Real-time:** Supabase channel subscription on `notifications` table (INSERT event, filtered by `user_id`)
- "Mark all read" clears badge instantly
- Clicking a notification navigates to the relevant fixture
- Mounted in `Navbar.jsx` between HTCC crest and profile dropdown

### NotificationsPage.jsx (`src/pages/member/NotificationsPage.jsx`)
- Route: `/notifications` (under `MemberRoute`)
- Groups notifications: **Today / Yesterday / This Week / This Month**
- Filter tabs: **All / Unread**
- Per-notification delete (× button)
- Mark all read button
- Clicking a notification navigates to fixture detail

### Reminder buttons
- **CaptainFixturesPage.jsx** — `🔔 Remind` button per upcoming fixture
- **AdminFixturesPage.jsx** — `🔔 Remind` button per upcoming fixture
- Both call `send_fixture_reminder(fixture_id)` RPC
- Toast: `Reminder sent to X players` or `All players have already responded`

---

## 11. UI Consistency Standards ✅

### Opponent name casing
All opponent names use `.toUpperCase()` across every page:
`DashboardPage` · `FixturesPage` · `TeamsPage` · `AdminDashboardPage` · `AdminFixturesPage` · `AdminMatchdayPage` · `CaptainFixturesPage`

### VS label standard
```jsx
<span style={{
  fontFamily: 'var(--font-display)',
  color: 'var(--gold)',   // Sunday cards use #60A5FA
  letterSpacing: '1px'
}}>VS</span>
```

### Home/Away badge standard
```jsx
<span style={{
  fontSize: '11px', fontWeight: 700,
  color: fixture.home_away === 'home' ? 'var(--green)'
       : fixture.home_away === 'away' ? '#60A5FA'
       : 'var(--text-muted)',
  background: fixture.home_away === 'home' ? 'rgba(34,197,94,0.1)'
            : fixture.home_away === 'away' ? 'rgba(96,165,250,0.1)'
            : 'rgba(255,255,255,0.04)',
  border: fixture.home_away === 'home' ? '1px solid rgba(34,197,94,0.25)'
        : fixture.home_away === 'away' ? '1px solid rgba(96,165,250,0.25)'
        : '1px solid var(--navy-border)',
  padding: '2px 8px', borderRadius: '4px',
}}>
  {fixture.home_away === 'home' ? '🏠 HOME'
 : fixture.home_away === 'away' ? '✈️ AWAY'
 : '⚖️ NEUTRAL'}
</span>
```

**Tag order on fixture cards:** Team badge → Home/Away badge → Match type badge

### HTCC crest badge pattern (team cards, navbar)
```jsx
<div style={{
  width: '44px', height: '44px', borderRadius: '50%',
  background: '#0D1B2A', border: '2px solid #F5C518',
  boxShadow: '0 0 0 3px rgba(245,197,24,0.15), 0 2px 10px rgba(0,0,0,0.6)',
  overflow: 'hidden', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}}>
  <img src="/assets/images/htcc-logo.png" alt="HTCC Crest"
    style={{ width: '100%', height: '100%', objectFit: 'cover',
      objectPosition: 'center 20%', mixBlendMode: 'screen' }} />
</div>
```
> `mixBlendMode: 'screen'` removes the black background from `htcc-logo.png`.

---

## 12. constants.js — Key Exports

```js
export const ROUTES = {
  DASHBOARD:     '/dashboard',
  FIXTURES:      '/fixtures',
  TEAMS:         '/teams',
  PROFILE:       '/profile',
  NOTIFICATIONS: '/notifications',    // ✅ NEW
  // captain
  CAPTAIN_FIXTURES: '/captain/fixtures',
  SQUAD_SELECTION:  '/captain/squad-selection/:fixtureId',
  // admin
  ADMIN_DASHBOARD:     '/admin',
  ADMIN_MATCHDAY:      '/admin/matchday',
  ADMIN_FIXTURES:      '/admin/fixtures',
  ADMIN_MEMBERS:       '/admin/members',
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
}

export const PAGE_TITLES = {
  ADMIN_OVERVIEW:      'Pavilion · Admin Overview',
  ADMIN_DASHBOARD:     'Pavilion · Admin Overview',   // alias — both keys required
  ADMIN_MATCHDAY:      'Pavilion · Matchday — Admin',
  ADMIN_FIXTURES:      'Pavilion · Fixtures — Admin',
  ADMIN_MEMBERS:       'Pavilion · Members — Admin',
  ADMIN_ANNOUNCEMENTS: 'Pavilion · Announcements — Admin',
  NOTIFICATIONS:       'Pavilion · Notifications',    // ✅ NEW
}

export const MATCH_TYPE_LABELS = {
  league:      '🏆 MCCL',
  cup:         '🏅 Cup',
  friendly:    '🤝 Friendly',
  sunday_comp: '☀️ CVSL',
}

export const NOTIFICATION_TYPES = {              // ✅ NEW
  AVAILABILITY_REMINDER: 'availability_reminder',
  SQUAD_PUBLISHED:       'squad_published',
  APPROVAL:              'approval',
  WELCOME:               'welcome',
  JOIN_APPROVED:         'join_approved',
  JOIN_REJECTED:         'join_rejected',
  CUSTOM:                'custom',
}

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  CAPTAIN:    'captain',
  MEMBER:     'member',
  PENDING:    'pending',
}
```

---

## 13. Navbar — Final Layout & Role-Based Nav

### Layout (left → right)
```
[Pavilion icon] [PAVILION / HTCC stacked] ........... [NotificationBell] [HTCC crest] [Profile dropdown]
```

- Dark mode toggle: **removed**
- `NotificationBell` sits between HTCC crest and profile dropdown

### Role-based nav links
```
MEMBER_NAV:  Home (/dashboard) · Fixtures (/fixtures) · My Teams (/teams)
CAPTAIN_NAV: Home · My Teams · Fixtures (/captain/fixtures)
ADMIN_NAV:   Overview · Matchday · Fixtures · Members · Announce
```
- Admin profile dropdown includes **Preview as Member** section

---

## 14. vite.config.js (Critical — do not change)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      '@supabase/functions-js',
      '@supabase/realtime-js',
      '@supabase/storage-js',
      '@supabase/postgrest-js',
      '@supabase/auth-js',
      'tslib',
    ],
  },
  resolve: { dedupe: ['tslib'] },
})
```

---

## 15. netlify.toml

```toml
[build]
  base    = "."
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

---

## 16. Supabase Config

| Setting | Value |
|---|---|
| Email confirmation | OFF (re-enable before go-live) |
| Site URL | `https://pavilion-htcc.netlify.app` |
| Redirect URLs | `https://pavilion-htcc.netlify.app/dashboard` |
| Realtime | Enabled on `notifications` table |
| pg_cron | Enabled; job: `pavilion-monday-availability-reminder` |

---

## 17. Key Bug Fixes Applied (All Sessions)

| # | Issue | Fix |
|---|---|---|
| 1 | `undefined` browser tab | Added `ADMIN_DASHBOARD` alias key to `PAGE_TITLES` |
| 2 | Pending approval dropdown reverting | Replaced with explicit Approve/Reject buttons |
| 3 | Join requests not showing on admin | FK pointed to `auth.users` not `public.profiles`; rebuilt constraint |
| 4 | RLS blocking role updates | Added `"Admins can update member roles"` policy on `profiles` |
| 5 | Fixture card inconsistency | Standardised all cards across Dashboard + Matchday + Fixtures pages |
| 6 | DashboardPage broken render | Removed old `sortedDates`/`fixturesByDate`; replaced with weekly navigator |
| 7 | SVG XML parse error | SVG `--` comments are invalid XML; removed all comments from icon SVG |
| 8 | Availability toggle-off not persisting | Missing `DELETE` RLS policy on `availability` table — added |
| 9 | Notifications not arriving in real-time | Realtime not enabled on `notifications` table — added via `alter publication` |

---

## 18. Key Patterns & Principles

- **PostgREST FK rule:** FK must point to `public.profiles` not `auth.users` for nested joins to work. Two-step fetch (join requests → then profiles separately, merge manually) as fallback.
- **Hybrid state = bugs:** Complete replacement of render blocks preferred over incremental patching when restructuring layout.
- **RLS full coverage:** All four operations (INSERT / SELECT / UPDATE / DELETE) must be explicitly covered per table. Missing DELETE was the root cause of availability toggle-off not persisting.
- **Permissions:** Enforced at BOTH UI layer and server layer for all role-sensitive operations.
- **SVG for web:** Never put `--` inside SVG XML (invalid). Always test at favicon size (24px).
- **Realtime:** Must explicitly `alter publication supabase_realtime add table <table>` for any table requiring live subscriptions — it is NOT on by default.
- **Toggle-off pattern:** Any user-driven status selection should support deselection by detecting `existing === newStatus` and issuing a DELETE rather than an UPDATE.

---

## 19. Pending Next Steps (Priority Order)

| Priority | Item | Notes |
|---|---|---|
| 🟡 1 | **Results tracking** | Add scores to past fixtures, win/loss record per team. Deferred — waiting for Play-Cricket API |
| 🟡 2 | **Player stats** | Appearances, availability rate per member. Depends on results data |
| 🟡 3 | **Admin Members page polish** | Role management UX, member profile view |
| 🟡 4 | **Profile page** | Let members update own details (phone, DOB, avatar) |
| 🟢 5 | **Mobile app scaffold** | Expo (Phase 3) — `expo_push_token` column already in `profiles` |
| 🟢 6 | **Email notifications** | Resend API (Phase 3) |

---

## 20. Run Commands

```powershell
# Start dev server
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-web
npm run dev

# Build for production
npm run build

# Deploy (auto via Netlify on git push to main)
git add .
git commit -m "your message"
git push
```

---

*Last updated: 13 March 2026 — covers navbar redesign, fixture display consistency, in-app notification system (bell, full page, real-time), Monday cron auto-reminder, manual reminder buttons, and availability toggle-off.*
