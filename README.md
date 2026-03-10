<!-- pavilion-web/README.md -->

# Pavilion — HTCC Club Management Platform

> **Harrow Town Cricket Club** · Est. 1921  
> Internal squad, availability, and fixture management platform.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Features Built](#features-built)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Pages Reference](#pages-reference)
- [Design System](#design-system)
- [Pending / Roadmap](#pending--roadmap)

---

## Overview

Pavilion is a private web application for Harrow Town Cricket Club members.  
It replaces WhatsApp group coordination with a structured platform for:

- Availability submission per fixture
- Squad selection and publication by captains
- Admin oversight of all teams on matchday
- Member management and team assignments
- Club announcements

---

## Tech Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Frontend     | React 18 + Vite 8 beta            |
| Styling      | TailwindCSS v4 + CSS custom props |
| Routing      | React Router v6                   |
| State        | Zustand                           |
| Backend/DB   | Supabase (PostgreSQL + Auth)      |
| Hosting      | Netlify (planned)                 |
| Mobile       | React Native + Expo (planned)     |

---

## Project Structure
```
pavilion-web/
├── public/
│   └── assets/images/htcc-logo.png
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.jsx          # Authenticated page wrapper + dark mode
│   │   │   ├── Navbar.jsx            # Sticky nav, role-based links, profile dropdown
│   │   │   └── ProtectedRoute.jsx    # MemberRoute, CaptainRoute, AdminRoute, PublicOnlyRoute
│   │   └── ui/
│   │       └── ConfirmModal.jsx      # Reusable modern confirmation modal
│   ├── lib/
│   │   ├── constants.js              # All enums, routes, page titles, config
│   │   └── supabase.js               # Supabase client initialisation
│   ├── pages/
│   │   ├── public/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── SignupPage.jsx
│   │   │   └── PendingPage.jsx
│   │   ├── member/
│   │   │   ├── DashboardPage.jsx     # Fixture cards + availability pills + announcements
│   │   │   ├── ProfilePage.jsx       # Edit profile, avatar colour, change password
│   │   │   └── TeamsPage.jsx         # My teams, upcoming fixtures, join requests
│   │   ├── captain/
│   │   │   ├── CaptainFixturesPage.jsx   # Create/edit/delete fixtures for own team
│   │   │   └── SquadSelectionPage.jsx    # Select 11, save draft, publish, re-publish
│   │   └── admin/
│   │       ├── AdminDashboardPage.jsx    # Overview stats + pending approvals
│   │       ├── AdminFixturesPage.jsx     # Full fixture management + squad access
│   │       ├── AdminMembersPage.jsx      # Member list, roles, team assignments
│   │       ├── AdminMatchdayPage.jsx     # 4-team Saturday grid with availability
│   │       └── AdminAnnouncementsPage.jsx # Post and manage announcements
│   ├── store/
│   │   └── authStore.js              # Zustand auth store — session, profile, role helpers
│   └── styles/
│       └── globals.css               # Full design system, CSS variables, component classes
├── supabase/
│   └── migrations/                   # (pending) versioned SQL migration files
├── .env.local                        # Supabase URL + anon key (never committed)
├── vite.config.js
└── README.md
```

---

## User Roles

| Role        | Permissions |
|-------------|-------------|
| `superadmin`| Full access to everything |
| `admin`     | All team management, fixtures, members, announcements |
| `captain`   | Own team fixtures + squad selection only |
| `member`    | View fixtures, set availability, view published squads |
| `pending`   | Holding state — awaiting admin approval after signup |

Role is stored in `public.profiles.role` and enforced via:
- Supabase Row Level Security policies
- React route guards (`CaptainRoute`, `AdminRoute`)
- UI conditionals per role

---

## Features Built

### Auth
- [x] Signup with email + name + phone
- [x] Email confirmation disabled for dev (re-enable before go-live)
- [x] Auto profile creation via Supabase trigger on signup
- [x] Pending approval flow — new members wait for admin
- [x] Login / logout with session persistence
- [x] Role-based protected routes

### Member
- [x] Dashboard with upcoming fixtures + availability pills
- [x] Club announcements visible on dashboard
- [x] Profile page — edit name, phone, avatar colour, change password
- [x] My Teams — view assigned teams, upcoming fixtures, join requests

### Captain
- [x] Captain Fixtures — create, edit, delete own team fixtures
- [x] Squad Selection — pick 11 from available players
- [x] Conflict check — blocks selecting player already in another squad same day
- [x] Save draft squad
- [x] Publish squad — locks selection, shows published timestamp
- [x] Re-publish — unlock, edit, and republish after changes

### Admin
- [x] Admin Overview — stats, pending approvals, upcoming fixtures
- [x] Approve / reject pending member applications
- [x] Fixtures — full CRUD across all teams + squad selection access
- [x] Members — role management, team assignments per member
- [x] Matchday Grid — all 4 Saturday XIs side by side, availability counts, player lists
- [x] Announcements — post to all / members / captains / admins, read more/less, delete

### UI / UX
- [x] Dark mode default, light mode toggle, persisted to localStorage
- [x] Modern confirm modal replaces all window.confirm()
- [x] Availability colour system — green / amber / red / grey
- [x] Responsive navbar with mobile hamburger
- [x] Role badge in profile dropdown
- [x] Avatar colour picker on profile page

---

## Database Schema

### Tables

| Table               | Purpose |
|---------------------|---------|
| `profiles`          | Extends auth.users — name, phone, role, avatar_color |
| `teams`             | 5 teams: 1st–4th XI (Saturday) + Sunday XI |
| `team_members`      | Many-to-many: players assigned to teams |
| `join_requests`     | Member requests to join a team |
| `fixtures`          | Matches per team — date, opponent, venue, home/away |
| `availability`      | One row per player per fixture — available/unavailable/tentative |
| `squads`            | One squad per fixture — published flag + timestamp |
| `squad_members`     | 11 players per squad with position order |
| `announcements`     | Club-wide or role-targeted messages |
| `notifications_log` | Push notification audit trail (future) |

### Key Rules
- A player cannot be selected in more than one squad on the same match date
- Squads lock on publish — require explicit unlock to edit
- RLS enforces all data access by role

---

## Getting Started

### Prerequisites
- Node.js v22+
- npm v11+
- Supabase project (free tier sufficient)

### Install
```powershell
cd pavilion-web
npm install
```

### Run Dev Server
```powershell
npm run dev
```

App runs at `http://localhost:5173`

---

## Environment Variables

> File: `pavilion-web\.env.local` — never commit this file.
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Pages Reference

| Route                              | Page                    | Access       |
|------------------------------------|-------------------------|--------------|
| `/`                                | Landing                 | Public       |
| `/login`                           | Login                   | Public only  |
| `/signup`                          | Signup                  | Public only  |
| `/pending`                         | Awaiting Approval       | Auth         |
| `/dashboard`                       | Member Dashboard        | Member+      |
| `/profile`                         | My Profile              | Member+      |
| `/teams`                           | My Teams                | Member+      |
| `/captain/fixtures`                | Captain Fixtures        | Captain+     |
| `/captain/fixtures/:id/squad`      | Squad Selection         | Captain+     |
| `/admin`                           | Admin Overview          | Admin+       |
| `/admin/fixtures`                  | Admin Fixtures          | Admin+       |
| `/admin/members`                   | Admin Members           | Admin+       |
| `/admin/matchday`                  | Matchday Grid           | Admin+       |
| `/admin/announcements`             | Announcements           | Admin+       |

---

## Design System

All tokens defined in `src/styles/globals.css`:

| Token               | Value     | Usage                    |
|---------------------|-----------|--------------------------|
| `--navy`            | `#0D1B2A` | Primary background       |
| `--gold`            | `#F5C518` | Primary accent           |
| `--green`           | `#22C55E` | Available / success      |
| `--red`             | `#EF4444` | Unavailable / danger     |
| `--amber`           | `#F5C518` | Tentative / warning      |
| `--font-display`    | Bebas Neue | Headings                |
| `--font-body`       | DM Sans   | Body text                |
| `--font-mono`       | JetBrains Mono | Stats / numbers     |

---

## Pending / Roadmap

### Next Immediate
- [ ] Sunday XI matchday tab
- [ ] Fixture detail page (member view of published squad)
- [ ] Admin join request management from Members page

### Phase 2
- [ ] Push notifications (Expo — mobile app)
- [ ] Monday availability reminder (Supabase Edge Function cron)
- [ ] Manual reminder button per fixture (captain)
- [ ] Season archive / results tracking

### Phase 3
- [ ] React Native + Expo mobile app scaffold
- [ ] Player statistics tracking
- [ ] Netlify deployment + custom domain
- [ ] Email notifications via Resend API