# Pavilion HTCC — Full Project Handover

> **Date:** April 2026  
> **Version:** 1.2.1 (Build 5 — submitted)  
> **Status:** iOS v1.2.0 Build 4 LIVE on App Store. Build 5 submitted April 2026 — awaiting App Store review.  
> **Author:** Anish Vekaria  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository & File Structure](#2-repository--file-structure)
3. [Tech Stack](#3-tech-stack)
4. [Accounts & Credentials](#4-accounts--credentials)
5. [Supabase Database Schema](#5-supabase-database-schema)
6. [Design System](#6-design-system)
7. [App Architecture — Native](#7-app-architecture--native)
8. [App Architecture — Web](#8-app-architecture--web)
9. [PlayCricket Sync Pipeline](#9-playcricket-sync-pipeline)
10. [Push Notifications](#10-push-notifications)
11. [What's Live — Feature Inventory](#11-whats-live--feature-inventory)
12. [Known Issues & Parking Lot](#12-known-issues--parking-lot)
13. [iOS Submission — Current Status](#13-ios-submission--current-status)
14. [Next Priority — Push Notification Token Fix](#14-next-priority--push-notification-token-fix)
15. [Next Priority — Deep Linking](#15-next-priority--deep-linking)
16. [Next Release — Planned Work v1.3.0](#16-next-release--planned-work-v130)
17. [Season Automation — Weekly Sync](#17-season-automation--weekly-sync)
18. [App Store Submission — Step by Step](#18-app-store-submission--step-by-step)
19. [Critical Rules — Never Break These](#19-critical-rules--never-break-these)
20. [How to Start a New Development Session](#20-how-to-start-a-new-development-session)
21. [Context Block for New Chat Sessions](#21-context-block-for-new-chat-sessions)

---

## 1. Project Overview

**Pavilion** is the official club management platform for Harrow Town Cricket Club (HTCC). It consists of three parts:

| Part | Description | URL / Location |
|---|---|---|
| Native app | iOS + Android mobile app | Expo SDK 54, React Native |
| Web app | Browser companion | `https://pavilion-htcc.netlify.app` |
| Sync pipeline | PlayCricket data importer | Python scripts, run manually |

**Five teams managed:**
- 1st XI (Saturday)
- 2nd XI (Saturday)
- 3rd XI (Saturday)
- 4th XI (Saturday)
- Sunday XI

**User roles (valid enum values only):**

| Role | Access |
|---|---|
| `pending` | Awaiting admin approval |
| `member` | Full member access |
| `captain` | Member + squad selection |
| `admin` | Captain + admin panel |
| `superadmin` | Full platform access |

> ⚠️ `rejected` and `super_admin` are NOT valid role values. Rejecting a member = DELETE the profile row. Never set `role = 'rejected'`.

---

## 2. Repository & File Structure

```
C:\Users\ravil\PycharmProjects\HTCC-Pavilion\
├── pavilion-app\
│   ├── App.jsx
│   ├── app.json
│   ├── eas.json
│   ├── HANDOVER.md
│   ├── DEPLOYMENT.md
│   ├── assets\
│   │   ├── pavilion-icon-1024.png      ← App Store icon (1024×1024, navy bg, no alpha)
│   │   ├── pavilion-icon-android.png   ← Android adaptive icon (60% padded, transparent bg)
│   │   ├── pavilion-icon.png           ← Original icon (transparent bg)
│   │   └── htcc-logo.png               ← HTCC crest
│   └── src\
│       ├── components\
│       │   ├── ErrorBoundary.jsx
│       │   ├── SplashV1_Orbit.jsx      ← Old splash (keep for reference)
│       │   ├── SplashV2_Fusion.jsx     ← Current splash
│       │   └── layout\TopHeader.jsx
│       ├── lib\
│       │   ├── constants.js
│       │   ├── supabase.js
│       │   ├── pushNotifications.js
│       │   └── promptHelper.js
│       ├── navigation\
│       │   ├── RootNavigator.jsx
│       │   ├── AuthNavigator.jsx
│       │   ├── MemberNavigator.jsx     ← Notification badge lives here
│       │   ├── AdminNavigator.jsx
│       │   └── CaptainNavigator.jsx
│       ├── screens\
│       │   ├── public\
│       │   │   ├── WelcomeScreen.jsx
│       │   │   ├── LoginScreen.jsx
│       │   │   ├── SignupScreen.jsx
│       │   │   ├── PendingScreen.jsx
│       │   │   └── CheckEmailScreen.jsx
│       │   ├── member\
│       │   │   ├── DashboardScreen.jsx
│       │   │   ├── FixturesScreen.jsx
│       │   │   ├── FixtureDetailScreen.jsx
│       │   │   ├── TeamsScreen.jsx
│       │   │   ├── StatsScreen.jsx
│       │   │   ├── NotificationsScreen.jsx
│       │   │   └── ProfileScreen.jsx   ← Includes Delete Account
│       │   ├── captain\
│       │   │   ├── CaptainFixturesScreen.jsx
│       │   │   └── SquadSelectionScreen.jsx
│       │   └── admin\
│       │       ├── AdminDashboardScreen.jsx
│       │       ├── AdminFixturesScreen.jsx
│       │       ├── AdminMembersScreen.jsx
│       │       ├── AdminMatchdayScreen.jsx
│       │       ├── AdminTrainingAnnouncementsScreen.jsx
│       │       ├── AdminTrainingScreen.jsx
│       │       ├── AdminAnnouncementsScreen.jsx
│       │       ├── AdminPanelProfileScreen.jsx
│       │       └── TrainingDetailScreen.jsx
│       ├── store\authStore.js
│       └── theme.js
│
├── pavilion-web\
└── pavilion-sync\
    ├── src\
    │   ├── sync_matches.py
    │   └── calc_awards.py
    ├── sql\001_pc_schema.sql
    └── .env
```

---

## 3. Tech Stack

### Native App
| Package | Purpose |
|---|---|
| Expo SDK 54 | Build toolchain |
| React Native | UI framework |
| React Navigation v7 | Navigation |
| Zustand | Global state |
| Supabase JS | Backend client |
| expo-notifications | Push notifications |
| expo-secure-store | Session persistence |
| react-native-safe-area-context | Safe area insets |
| @react-native-community/datetimepicker | Date picker |
| expo-google-fonts | Bebas Neue + DM Sans |

### Web App
| Package | Purpose |
|---|---|
| React 18 + Vite | Framework |
| TailwindCSS v4 | Styling |
| Netlify | Hosting — auto-deploy on git push |

### Backend
| Service | Purpose |
|---|---|
| Supabase Postgres | Database |
| Supabase Auth | Authentication |
| Supabase RLS | Row-level security |
| Supabase Realtime | Live updates |
| Supabase Edge Functions | Approval emails |
| Expo Push Service | Push notifications |

### Sync Pipeline
| Package | Purpose |
|---|---|
| Python 3 | Runtime |
| supabase-py | Supabase client |
| requests / BeautifulSoup | PlayCricket scraper |
| python-dotenv | Environment variables |

---

## 4. Accounts & Credentials

| Service | Account | Notes |
|---|---|---|
| Expo | `nishvek10` / `anish.vek10@gmail.com` | Build + submit |
| Supabase | `anish.vek10@gmail.com` | Project ref: `nqhhvataxjaecctvrrzc` |
| Apple Developer | `anish.vek10@gmail.com` | Team: `7T4DG8HHMT` |
| App Store Connect | `anish.vek10@gmail.com` | App ID: `6761196439` |
| Netlify | `anish.vek10@gmail.com` | Web app hosting |
| PlayCricket | — | API token in `.env`, Site ID: `3199` |

### PlayCricket team IDs
| Team | PlayCricket ID |
|---|---|
| 1st XI | 23 |
| 2nd XI | 20 |
| 3rd XI | 18 |
| 4th XI | 18 |
| Sunday XI | 9 |

### Supabase keys
- `SUPABASE_URL` — public URL (safe for client)
- `SUPABASE_ANON_KEY` — for app client (RLS enforced)
- `SUPABASE_SERVICE_KEY` — Python pipeline only (bypasses RLS — never expose in app)

---

## 5. Supabase Database Schema

### Core tables
| Table | Purpose |
|---|---|
| `profiles` | All users — extends auth.users |
| `teams` | 5 HTCC teams |
| `team_members` | Player ↔ team assignments |
| `fixtures` | All matches |
| `availability` | Player availability per fixture |
| `squads` | Published squads per fixture |
| `squad_members` | Players per squad — `position_order`, `is_captain`, `is_wicketkeeper` |
| `join_requests` | Team join requests |
| `announcements` | Club announcements |
| `training_sessions` | Training sessions |
| `training_availability` | Player availability per training session |
| `notifications` | In-app notification inbox |
| `notifications_log` | Push notification audit trail |

### PlayCricket tables (prefixed `pc_`)
| Table | Purpose |
|---|---|
| `pc_matches` | Synced match records |
| `pc_innings` | Innings per match |
| `pc_batting` | Batting rows (includes `fielder_name`, `how_out`) |
| `pc_bowling` | Bowling rows |
| `pc_match_players` | Players per match, HTCC flag |
| `pc_match_points` | POTM points per player per match |
| `pc_season_stats` | Aggregated season stats per player |
| `pc_players` | PlayCricket player registry |
| `pc_sync_log` | Sync run history |

### Key columns
- `profiles.role` — enum: `pending`, `member`, `captain`, `admin`, `superadmin`
- `profiles.expo_push_token` — Expo push token, re-registered on each fresh install login
- `profiles.pc_member_id` — links to PlayCricket player (Anish = `5832541`)
- `squad_members.position_order` — batting order (NOT `position`)
- `squad_members.is_captain` / `is_wicketkeeper` — role flags
- `notifications.read` — boolean for badge count

### Account deletion function
```sql
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
```
Deletes `auth.users` row → cascades to `profiles` → cascades to all child tables.
Called from `ProfileScreen.jsx` via `supabase.rpc('delete_user')`.

---

## 6. Design System

### Colours
| Name | Hex | Usage |
|---|---|---|
| Navy | `#0D1B2A` | Primary background |
| NavyLight | `#162236` | Card background |
| Gold | `#F5C518` | Primary accent, CTAs |
| Green | `#22C55E` | Available, success |
| Red | `#EF4444` | Unavailable, error |
| Sunday Blue | `#60A5FA` | Sunday fixtures, training |
| Purple | `#A78BFA` | Role changes, admin |
| Orange | `#F97316` | Tentative, warnings |
| TextMuted | `#8B9BB4` | Secondary text |

### Fonts
| Variable | Font | Usage |
|---|---|---|
| `fonts.display` | Bebas Neue | Headers, big numbers |
| `fonts.body` | DM Sans Regular | Body text |
| `fonts.medium` | DM Sans Medium | Emphasised body |
| `fonts.bold` | DM Sans Bold | Labels, badges, buttons |

---

## 7. App Architecture — Native

### Navigation structure
```
RootNavigator
├── key="no-session"  → AuthNavigator (Welcome, Login, Signup, CheckEmail, Pending)
├── key="pending"     → AuthNavigator (same, fresh mount on role change)
└── Authenticated
    ├── MemberNavigator   ← always base layer
    │   ├── Tabs: Home · Fixtures · Teams · Stats · Alerts · Profile
    │   └── Stack: FixtureDetailScreen
    ├── AdminNavigator    ← pushed over member
    │   ├── Tabs: Overview · Matchday · Fixtures · Members · Sessions · Profile
    │   └── Stack: SquadSelectionScreen, TrainingDetailScreen
    └── CaptainNavigator  ← pushed over member
        ├── Tabs: Fixtures · Profile
        └── Stack: SquadSelectionScreen
```

### Real-time channels active
| Screen | Table | Events |
|---|---|---|
| MemberNavigator badge | `notifications` | INSERT |
| DashboardScreen | `fixtures` | `*` |
| FixturesScreen | `fixtures`, `squads` | `*` |
| AdminDashboardScreen | `profiles`, `join_requests`, `fixtures` | `*` |
| AdminMembersScreen | `profiles`, `team_members` | `*` |

### Session persistence
`expo-secure-store` persists sessions. Users stay logged in until manual sign out. No logout on close or background.

---

## 8. App Architecture — Web

- React 18 + Vite + TailwindCSS v4
- Auto-deploys to Netlify on git push to main
- Email confirmation redirect currently: `https://pavilion-htcc.netlify.app/login`
- Will change to `pavilion://login` after deep linking is implemented (Section 15)

---

## 9. PlayCricket Sync Pipeline

### Run commands
```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-sync
python -m src.sync_matches
python -m src.calc_awards
```

### sync_matches.py
- Fetches all 5 HTCC team fixtures from PlayCricket API
- Upserts matches, innings, batting, bowling, match players
- Safe to re-run — uses upsert with unique conflict keys
- Last confirmed: 83 matches, 0 errors

### calc_awards.py
- Calculates batting + bowling + fielding points per player per match
- Awards POTM to highest scorer per match
- Rebuilds `pc_season_stats` (full DELETE + reinsert)
- Last confirmed: 901 POTM rows, 86 season stat rows

### Points system (fully configurable at top of calc_awards.py)
| Action | Points |
|---|---|
| Per run | 1 |
| Per four | +1 |
| Per six | +2 |
| Reach 25 | +5 |
| Reach 50 | +10 |
| Reach 100 | +25 |
| Not out | +5 |
| Duck | -3 |
| SR ≥ 150 (min 10 balls) | +10 |
| SR ≥ 100 | +5 |
| SR < 50 | -5 |
| Per wicket | 20 |
| 3 wicket haul | +5 |
| 5 wicket haul | +20 |
| Per maiden | 3 |
| Economy < 4 (min 4 overs) | +15 |
| Economy < 5 | +10 |
| Economy < 6 | +5 |
| Economy ≥ 10 | -5 |
| Catch | 10 |
| Run out | 10 |
| Stumping | 12 |

### Fielding logic — critical
- Read from `pc_batting.fielder_name` and `pc_batting.how_out`
- `how_out`: `ct` = catch, `st` = stumping, `ro`/`run out` = run out
- Only counts when `fielder_id` is an HTCC player in that match
- Batter must be opposition — prevents double counting
- ⚠️ Fielding loop MUST be outside the `bat_counts` loop — previous nesting caused multiplied counts, now fixed

---

## 10. Push Notifications

### How it works
1. `registerPushToken()` called in `App.jsx` after profile loads on login
2. Token saved to `profiles.expo_push_token`
3. Expo Push API sends device notifications
4. `notifications` table row inserted simultaneously for in-app inbox

### Helper functions (`src/lib/pushNotifications.js`)
| Function | Purpose |
|---|---|
| `registerPushToken(userId)` | Register device token |
| `sendPushToUser(userId, title, body, data)` | Push to one user |
| `sendPushToUsers(userIds, title, body, data)` | Push to multiple users |
| `sendPushToRole(role, title, body, data)` | Push to all of a role |
| `insertNotification(userId, type, title, body)` | Single in-app row |
| `insertNotifications(userIds, type, title, body)` | Bulk in-app rows |
| `insertNotificationsForRole(role, type, title, body)` | Role-wide in-app rows |

### Notification types
| Type | Trigger |
|---|---|
| `availability_reminder` | Captain prompts player |
| `squad_published` | Captain publishes Playing XI |
| `approval` | Admin approves membership or join request |
| `role_change` | Captain/admin promotion |
| `team_added` | Added to a team |
| `announcement` | Club announcement posted |
| `welcome` | New member welcome |

### Admin notifications
- New member signup → all admins get push + in-app
- Team join request → all admins get push + in-app

---

## 11. What's Live — Feature Inventory

### Member
- [x] Welcome screen — animated CountUp stats, dual logos, est. badge
- [x] Splash — dual logo fusion, typewriter, dual orbit rings
- [x] Signup — phone code dropdown, password strength checker
- [x] Dashboard — week navigator, fixture cards, training, announcements
- [x] Personal availability bar on fixture cards (no team counts)
- [x] Fixture list — filters (upcoming/past, team, home/away, type)
- [x] Fixture detail — Playing XI with position order, C/WK badges, YOU tag
- [x] Teams — fixture carousel, join requests, canonical sort (1st→2nd→3rd→4th→Sunday)
- [x] Stats — batting/bowling/awards, team filters, player modal with fielding stats
- [x] Notifications — grouped by date, mark read, real-time badge
- [x] Profile — edit name/phone/avatar, change password, delete account

### Captain
- [x] Squad selection — alphabetical pool, drag reorder, C/WK required to publish
- [x] Publish squad — notifies selected players instantly
- [x] Availability prompt per player
- [x] Unlock and re-publish

### Admin
- [x] Dashboard — stats, pending approvals, join requests, real-time
- [x] Add/edit/delete fixtures with date picker
- [x] Member management — role change, team assignment, approve/reject
- [x] Training session management
- [x] Announcements — post to all/members/captains/admins
- [x] Matchday overview
- [x] Admin notified on new signup and join requests

### Platform
- [x] Real-time updates all key screens
- [x] Push notifications all events
- [x] Safe area insets all tab navigators
- [x] Error boundary
- [x] Session persistence
- [x] Account deletion (Apple requirement — full cascade)
- [x] Android adaptive icon with safe zone padding

---

## 12. Known Issues & Parking Lot

| Issue | Status | Notes |
|---|---|---|
| Sign out from PendingScreen | Parked | Expo Go limitation — test on live build |
| Training session edit | Deferred | Create/delete works, edit UI not built |
| PlayCricket official ECB API token | Pending | Applied for, scraper used as interim |
| Android Play Store submission | Not started | APK tested, AAB needed for Play Store |
| Deep linking | ✅ Done | `pavilion://` scheme, `emailRedirectTo`, cold-start + background handlers, Supabase redirect URL added |
| Push notifications (background/closed) | ✅ Fixed — Build 5 | app.json duplicate mode fixed, response listeners added, projectId fallback added. Users with null tokens must log out and back in after install. |
| App performance | Fixed | Full useMemo / useCallback / React.memo pass across all screens and navigators. Production build will show full benefit (Hermes + minified bundle). |
| Emoji icons throughout app | ✅ Done | Full PNG icon system built — `AppIcon.jsx` with `ICON_SCALE` and `FORCED_TINTS`. All screens updated. |
| Admin web dashboard — pending approvals | Pending | Join request approvals not showing on web admin dashboard. Fix pending. |

---

## 13. iOS Submission — Current Status

| Item | Status |
|---|---|
| Build 3 — first submission | ❌ Rejected — missing account deletion |
| Account deletion added to ProfileScreen | ✅ Fixed |
| Build 4 — resubmission | ✅ Approved — LIVE on App Store |
| Build 5 — submitted | 🔄 Awaiting App Store review — version 1.2.1 |

**Rejection reason (resolved):**
Guideline 5.1.1(v) — Account deletion required. Fixed by adding Delete Account to Profile screen with double confirmation and `supabase.rpc('delete_user')` cascade.

**Build details:**
- Version: `1.2.1` / Build: `5`
- Bundle ID: `com.htcc.pavilion`
- EAS build ID: `85d652b1-8901-47ff-8616-c21f850b057e`
- App Store Connect: `https://appstoreconnect.apple.com/apps/6761196439`

---

## 14. Push Notification Fix — Pending Build 5

### Problems fixed (April 2026)
Three issues found and resolved. Requires Build 5 to take effect on device.

| File | Fix applied |
|---|---|
| `app.json` | `UIBackgroundModes` had `"remote-notification"` listed twice — deduplicated to one entry |
| `App.jsx` | Added `addNotificationResponseReceivedListener` — handles notification tap from backgrounded state |
| `App.jsx` | Added `getLastNotificationResponseAsync` cold-start check — handles app opened by tapping notification when fully closed |
| `pushNotifications.js` | Added hardcoded `projectId` fallback (`839c48f3-c7a2-4fbd-a9c8-98e76daef60e`) so token registration never silently fails in production if `Constants.expoConfig` resolves differently |

### Token status (as of April 2026)
7 users have null tokens — all will auto-fix on first login after Build 5 installs. All existing users are being wiped and re-registered before public launch anyway.

### Monitor in production
Run this SQL periodically in Supabase to find users missing tokens:
```sql
SELECT id, full_name, role, expo_push_token 
FROM profiles 
WHERE expo_push_token IS NULL 
AND role != 'pending';
```

### Token count check
```sql
SELECT
  COUNT(*) FILTER (WHERE expo_push_token IS NOT NULL) AS tokens_present,
  COUNT(*) FILTER (WHERE expo_push_token IS NULL)     AS tokens_missing,
  COUNT(*)                                            AS total_members
FROM profiles
WHERE role != 'pending';
```

---

## 15. Next Priority — Deep Linking

### Goal
Tapping a link in an email or notification opens the app directly to the correct screen.

### Current vs target behaviour
| Trigger | Current | Target |
|---|---|---|
| Email confirmation link | Opens browser | Opens app → login |
| Admin approval email | Opens browser | Opens app → login |
| Squad notification tap | Opens app | Opens fixture detail ✅ |
| Availability reminder tap | Opens app | Opens fixture detail ✅ |

### Files to share before implementing
1. `App.jsx` — current version
2. `src/lib/constants.js` — to check SCREENS and add deep link constants

### Implementation plan

**Step 1 — `app.json`**

Add inside the `"expo"` block:
```json
"scheme": "pavilion"
```

**Step 2 — `src/store/authStore.js`**

Find:
```js
emailRedirectTo: 'https://pavilion-htcc.netlify.app/login',
```
Replace with:
```js
emailRedirectTo: 'pavilion://login',
```

**Step 3 — `App.jsx`**

Add Linking listener:
```js
import * as Linking from 'expo-linking'

// Add inside App component:
useEffect(() => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url)
  })
  Linking.getInitialURL().then(url => {
    if (url) handleDeepLink(url)
  })
  return () => subscription.remove()
}, [])

const handleDeepLink = (url) => {
  if (!url) return
  // pavilion://login — session set automatically by Supabase auth listener
  // RootNavigator handles routing based on session state
}
```

**Step 4 — Supabase email templates**

In Supabase Dashboard → Authentication → Email Templates:
- Confirmation email → change redirect URL to `pavilion://login`
- This opens app instead of browser on link tap

---

## 15.5. Completed in v1.2.1 Sprint (April 2026)

| Item | Detail |
|---|---|
| Push notification fix | Background + cold-start handlers, duplicate UIBackgroundModes, projectId fallback |
| Performance — all screens | Full `useMemo` / `useCallback` / `React.memo` pass across every screen and navigator |
| Performance — navigators | `MemberNavigator`, `AdminNavigator`, `CaptainNavigator` tab icons all memoised |
| Performance — double fetch fix | `DashboardScreen` was double-fetching fixtures on mount — resolved |
| Deep linking | `"scheme": "pavilion"` in `app.json`, `emailRedirectTo: 'pavilion://'`, `Linking` listener in `App.jsx`, Supabase Redirect URLs updated |
| Icon system — `src/lib/icons.js` | Central PNG registry — 37 icons mapped by name |
| Icon system — `src/components/AppIcon.jsx` | Reusable component — `ICON_SCALE = 2.2` global multiplier, `FORCED_TINTS` for date/time/venue colours |
| Icon system — `assets/icons/` | 48×96px white PNG exports — all tab bar + in-screen icons |
| Tab bar icons | Gold ring on focused tab — `width:32, height:32, borderRadius:16`, `borderWidth:1.5`, `tintColor: colors.gold` active / 45% white inactive |
| Emoji replacement | All screens fully updated — Dashboard, Fixtures, FixtureDetail, Teams, Stats, AdminDashboard, AdminFixtures, AdminMatchday, AdminTraining, TrainingDetail, SquadSelection, Profile, AdminPanelProfile, CaptainFixtures |
| C/WK badges | `captainBadge` icon gold tint, `wkBadge` icon blue tint — no container, icons only |
| Medal rings — StatsScreen | `width:36, height:36` ring with `MEDAL_ACCENT` border colours, icon `width:28, height:28` |
| Splash screen | Pavilion icon smaller inside ring (`78%`), HTCC crest larger (`108%`) — rings same size |
| TopHeader | HTCC crest ring removed — matches Pavilion icon style, `width:42, height:42, borderRadius:11` |
| Filter team sort | Canonical order 1st→2nd→3rd→4th→Sunday applied in `FixturesScreen.jsx` |
| `MIN_SPLASH_MS` | Reduced from `6500` to `3500` |

---

## 16. Next Release — Planned Work v1.3.0

### Team of the Week
Select highest-scoring player per position across all teams each week.

**Needed:**
- New `pc_team_of_week` table in Supabase
- New `calc_team_of_week()` function in `calc_awards.py`
- New section in `StatsScreen.jsx` or dedicated screen
- Admin trigger to publish

### Training session edit
Edit title, date, time, venue — create/delete already works. **Priority for v1.3.0.**

### Android Play Store
```powershell
eas build --platform android --profile production
eas submit --platform android
```
Requires Google Play Console setup ($25 one-time fee).

### Version 2.0.0 — future
- Match scorecards in-app
- Head-to-head player comparison
- Season history year-on-year
- Push notification preferences
- Live scoring

---

## 17. Season Automation — Weekly Sync

### Windows Task Scheduler (recommended)

Create `pavilion-sync\run_weekly_sync.bat`:
```batch
@echo off
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-sync
python -m src.sync_matches
python -m src.calc_awards
```

Set up Task Scheduler → Weekly → Monday → 09:00 AM → run bat file.

### GitHub Actions (cloud — no local machine needed)

```yaml
# .github/workflows/weekly-sync.yml
name: Weekly PlayCricket Sync
on:
  schedule:
    - cron: '0 9 * * 1'
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r pavilion-sync/requirements.txt
      - run: python -m src.sync_matches
        working-directory: pavilion-sync
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          PC_API_TOKEN: ${{ secrets.PC_API_TOKEN }}
      - run: python -m src.calc_awards
        working-directory: pavilion-sync
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

Add secrets in GitHub repo settings.

### Season schedule
| Period | Action |
|---|---|
| Pre-season (March) | Run manually |
| Season (April–September) | Weekly automated — every Monday |
| End of season (October) | Final sync + review |
| Off-season | No sync needed |

---

## 18. App Store Submission — Step by Step

### Pre-build checklist
1. Bump `version`, `ios.buildNumber`, `android.versionCode` in `app.json`
2. Test on device via Expo Go
3. Ensure test account exists and is approved

### Build and submit iOS
```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas build --platform ios --profile production
eas submit --platform ios
```

### After submit — App Store Connect
1. Wait 5–10 mins for binary processing
2. Go to `appstoreconnect.apple.com/apps/6761196439`
3. Version page → Build → Add Build → select new build
4. Update **What's New in This Version**
5. Click **Submit for Review** → answer export compliance → **No**

### Version rules
| Field | Rule |
|---|---|
| `version` | User-facing e.g. `1.2.0` → `1.3.0` |
| `ios.buildNumber` | Must increment every submission e.g. `"4"` → `"5"` |
| `android.versionCode` | Must increment every submission e.g. `4` → `5` |

### App Store listing reference
| Field | Value |
|---|---|
| App name | `Pavilion HTCC` |
| Bundle ID | `com.htcc.pavilion` |
| SKU | `pavilion-htcc` |
| App ID | `6761196439` |
| Category | Sports |
| Age rating | 4+ |
| Price | Free |
| Support URL | `https://pavilion-htcc.netlify.app` |

### Review notes template
```
Pavilion is a private club app for Harrow Town Cricket Club.
Account access requires admin approval.

Test credentials:
Email: [test email]
Password: [test password]

Full member access including fixtures, stats, notifications and squad selection.
```

### Android APK (internal test only)
```powershell
eas build --platform android --profile preview
```
Download APK → install directly on Android device.

---

## 19. Critical Rules — Never Break These

| Rule | Detail |
|---|---|
| `toLocalISO()` always | Never `.toISOString().split('T')[0]` — BST offset shifts Saturday to Sunday |
| Never `role = 'rejected'` | DELETE profile row instead — not a valid enum |
| Never reinstall reanimated/draggable-flatlist/gesture-handler | Breaks `react-native-worklets/plugin` with SDK 54 |
| `babel.config.js` — no plugins array | Only `babel-preset-expo` |
| Admin tab bar at 6-tab limit | Merge new sections into existing tabs |
| Python pipeline uses `service_role` key | Anon key blocked by RLS |
| `squad_members.position_order` | NOT `position` — wrong column crashes query |
| Notification badge via Zustand | `setUnreadCount` direct mutation — real-time UPDATE unreliable for clearing |
| `embedded={true}` | Suppresses `TopHeader` in combined container screens |
| `AppIcon ICON_SCALE` | Single value in `AppIcon.jsx` scales ALL in-screen icons — never hardcode sizes in screens |
| `AppIcon FORCED_TINTS` | `date` = gold, `time` = gold, `venue` = blue — override here, updates everywhere |
| Medal/trophy icons | Never apply `tintColor` — they have their own colours |
| Tab bar icon sizes | `width:28, height:28` inside `width:32, height:32` ring — set in navigators not AppIcon |
| Fielding loop outside `bat_counts` loop | Nesting multiplied counts — fixed, never re-nest |
| `useSafeAreaInsets()` on all three tab navigators | Member, Admin, Captain — prevents bottom bar overlap on Android + iPhone home indicator |

---

## 20. How to Start a New Development Session

### Native app
```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
npx expo start --clear
```

### Web app
```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-web
npm run dev
```

### Sync pipeline
```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-sync
python -m src.sync_matches
python -m src.calc_awards
```

---

## 21. Context Block for New Chat Sessions

**Paste this at the start of any new chat:**

---

> I am building **Pavilion HTCC** — a full-stack cricket club management platform for Harrow Town Cricket Club.
>
> **Stack:** Expo SDK 54, React Native, React Navigation v7, Zustand, Supabase (Postgres + RLS + Realtime), Python sync pipeline, React 18 web app on Netlify.
>
> **Paths:**
> - App: `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app\`
> - Web: `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-web\`
> - Sync: `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-sync\`
> - Live web: `https://pavilion-htcc.netlify.app`
>
> **Accounts:** Expo `nishvek10`, Supabase ref `nqhhvataxjaecctvrrzc`, Apple Team `7T4DG8HHMT`, App Store App ID `6761196439`, Bundle ID `com.htcc.pavilion`
>
> **Current version:** `1.2.1` / Build `5` (submitted — awaiting App Store review)
> **iOS:** v1.2.1 Build 5 submitted April 2026. Awaiting review.
> **Android:** APK tested internally, Play Store not yet submitted
>
> **Critical rules:**
> - `toLocalISO()` always, never `.toISOString().split('T')[0]`
> - Valid roles: `pending` `member` `captain` `admin` `superadmin` — rejecting = DELETE profile row
> - Never reinstall `react-native-reanimated`, `react-native-draggable-flatlist`, `react-native-gesture-handler`
> - `squad_members` uses `position_order` not `position`
> - Notification badge clears via Zustand `setUnreadCount` direct mutation
> - All three tab navigators use `useSafeAreaInsets()` for bottom bar height
> - Account deletion: `supabase.rpc('delete_user')` — cascades all data
> - `MIN_SPLASH_MS` in `App.jsx` currently `6500` — reduce to `3500` before next build if desired
>
> **Completed in current sprint (v1.2.1):**
> 1. Push notification fixes — background handler, cold-start handler, duplicate UIBackgroundModes, projectId fallback
> 2. Full performance pass — useMemo / useCallback / React.memo across all screens and navigators
> 3. Deep linking — `pavilion://` scheme, emailRedirectTo, Linking listener, Supabase redirect URL
> 4. Full PNG icon system — `AppIcon.jsx`, `icons.js`, `ICON_SCALE`, `FORCED_TINTS`, 37 icons
> 5. All emojis replaced across every screen — tab bar, in-screen, badges, meta rows
> 6. TopHeader HTCC crest ring removed, sized up to 42px
> 7. Splash screen logo sizing — Pavilion smaller inside ring, HTCC crest larger
> 8. Filter team canonical sort order
>
> **Immediate next priorities:**
> 1. Admin web dashboard — pending join request approvals not showing
> 2. Training session edit — native app (v1.3.0)
> 3. Android Play Store submission
>
> **Next release v1.3.0:**
> - Team of the Week feature
> - Training session edit
> - Android Play Store submission
> - In-app score submission — admin/captain can record batting, bowling, and fielding scores for the Playing XI post-match, auto-calculating points and awarding POTM instantly without waiting for the weekly PlayCricket sync
>
> **Season sync:** Run `python -m src.sync_matches` then `python -m src.calc_awards` every Monday from `pavilion-sync\` directory. Automate via Windows Task Scheduler or GitHub Actions.

---

*Last updated: April 2026 — Pavilion v1.2.1 Build 5 submitted*
