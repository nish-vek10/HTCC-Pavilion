# Pavilion HTCC — Handover v2

> **Date:** April 2026
> **Version:** 1.2.1 / Build 5
> **iOS:** LIVE on App Store
> **Android:** AAB submitted to Google Play Store — APK available for sideload
> **Author:** Anish Vekaria

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository & File Structure](#2-repository--file-structure)
3. [Tech Stack](#3-tech-stack)
4. [Accounts & Credentials](#4-accounts--credentials)
5. [Supabase Database Schema](#5-supabase-database-schema)
6. [Design System](#6-design-system)
7. [Icon System](#7-icon-system)
8. [App Architecture — Native](#8-app-architecture--native)
9. [App Architecture — Web](#9-app-architecture--web)
10. [PlayCricket Sync Pipeline](#10-playcricket-sync-pipeline)
11. [Push Notifications](#11-push-notifications)
12. [What's Live — Feature Inventory](#12-whats-live--feature-inventory)
13. [Known Issues & Parking Lot](#13-known-issues--parking-lot)
14. [iOS & Android Submission Status](#14-ios--android-submission-status)
15. [Completed This Sprint — v1.2.1](#15-completed-this-sprint--v121)
16. [Next Release — v1.3.0](#16-next-release--v130)
17. [Season Automation — Weekly Sync](#17-season-automation--weekly-sync)
18. [App Store Submission — Step by Step](#18-app-store-submission--step-by-step)
19. [Android APK — Sideload Build](#19-android-apk--sideload-build)
20. [Fixture Venue Update Process](#20-fixture-venue-update-process)
21. [Critical Rules — Never Break These](#21-critical-rules--never-break-these)
22. [How to Start a New Development Session](#22-how-to-start-a-new-development-session)
23. [Context Block for New Chat Sessions](#23-context-block-for-new-chat-sessions)

---

## 1. Project Overview

**Pavilion** is the official club management platform for Harrow Town Cricket Club (HTCC). It replaced Pitchero as the club's primary tool from the 2026 season. It consists of three parts:

| Part | Description | URL / Location |
|---|---|---|
| Native app | iOS + Android mobile app | Expo SDK 54, React Native |
| Web app | Browser companion | `https://pavilion-htcc.netlify.app` |
| Sync pipeline | PlayCricket data importer | Python scripts, run manually or automated |

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
│   ├── HANDOVER_V2.md                    ← this file
│   ├── assets\
│   │   ├── pavilion-icon-1024.png         ← App Store icon (1024×1024, navy bg, no alpha)
│   │   ├── pavilion-icon-android.png      ← Android adaptive icon (60% padded, transparent bg)
│   │   ├── pavilion-icon.png              ← Original icon (transparent bg)
│   │   ├── htcc-logo.png                  ← HTCC crest
│   │   └── icons\                         ← All PNG icon exports (96×96px, white on transparent)
│   │       ├── ic_home-TAB.png
│   │       ├── ic_fixtures-TAB.png
│   │       ├── ic_stats-TAB.png
│   │       ├── ic_alerts-TAB.png
│   │       ├── ic_profile-TAB.png
│   │       ├── ic_ADmatchday-TAB.png
│   │       ├── ic_ADmembers-TAB.png
│   │       ├── ic_ADtraining-TAB.png
│   │       ├── ic_date.png
│   │       ├── ic_time.png
│   │       ├── ic_venue.png
│   │       ├── ic_home_fixture.png
│   │       ├── ic_away_fixture.png
│   │       ├── ic_neutral.png
│   │       ├── ic_back.png
│   │       ├── ic_add.png
│   │       ├── ic_edit.png
│   │       ├── ic_delete.png
│   │       ├── ic_send.png
│   │       ├── ic_search.png
│   │       ├── ic_filter.png
│   │       ├── ic_approve.png
│   │       ├── ic_reject.png
│   │       ├── ic_pending.png
│   │       ├── ic_admin.png
│   │       ├── ic_signout.png
│   │       ├── ic_captain_badge.png
│   │       ├── ic_wk_badge.png
│   │       ├── ic_squad_out.png
│   │       ├── ic_conflict.png
│   │       ├── ic_gold_medal.png
│   │       ├── ic_silver_medal.png
│   │       ├── ic_bronze_medal.png
│   │       ├── ic_trophy.png
│   │       ├── ic_cricket_bat.png
│   │       ├── ic_cricket_bowl.png
│   │       └── ic_cricket_field.png
│   └── src\
│       ├── components\
│       │   ├── AppIcon.jsx                ← Central icon renderer — ICON_SCALE + FORCED_TINTS
│       │   ├── ErrorBoundary.jsx
│       │   ├── SplashV1_Orbit.jsx         ← Old splash (keep for reference)
│       │   ├── SplashV2_Fusion.jsx        ← Current splash
│       │   └── layout\TopHeader.jsx
│       ├── lib\
│       │   ├── constants.js
│       │   ├── icons.js                   ← Central icon registry — 37 icons mapped by name
│       │   ├── supabase.js
│       │   ├── pushNotifications.js
│       │   └── promptHelper.js
│       ├── navigation\
│       │   ├── RootNavigator.jsx
│       │   ├── AuthNavigator.jsx
│       │   ├── MemberNavigator.jsx
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
│       │   │   └── ProfileScreen.jsx
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
| expo-linking | Deep linking |
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
| Google Play Console | `anish.vek10@gmail.com` | Developer ID: `5496674967732676898` |
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

### Fixture venue conventions
- **Home:** `HTCC, Rayners Lane HA2 9TY`
- **Away:** correct ground names — updated manually via staging table process (see Section 20)

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
| Gold | `#F5C518` | Primary accent, CTAs, date/time icons |
| Green | `#22C55E` | Available, success |
| Red | `#EF4444` | Unavailable, error |
| Sunday Blue | `#60A5FA` | Sunday fixtures, training, venue icons |
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

## 7. Icon System

### Overview
All in-screen icons use PNG exports — no emojis anywhere in the app. The icon system is centralised through two files:

### `src/lib/icons.js`
Central registry mapping 37 icon names to PNG requires. Always add new icons here first.

### `src/components/AppIcon.jsx`
Reusable component — renders any icon from the registry.

**Key configurable values at the top of `AppIcon.jsx`:**

```js
// Controls ALL in-screen icon sizes globally — change once, updates everywhere
const ICON_SCALE = 2.2

// Forces specific tint colours regardless of what tint prop is passed
// Change here and it updates across every screen automatically
const FORCED_TINTS = {
  date:  '#F5C518',   // gold
  time:  '#F5C518',   // gold
  venue: '#60A5FA',   // blue
}
```

**Usage:**
```jsx
// White icon with tint applied at runtime
<AppIcon name="edit" size={14} tint={colors.gold} />

// Icon with forced tint (date/time/venue) — tint prop ignored
<AppIcon name="date" size={13} tint={colors.white} />

// Medal/trophy icons — NO tintColor, they have own colours
<AppIcon name="goldMedal" size={20} />
```

### Tab bar icons
Applied in `MemberNavigator`, `AdminNavigator`, `CaptainNavigator`:
- Ring: `width:32, height:32, borderRadius:16`
- Focused: `borderWidth:1.5, borderColor: colors.gold, backgroundColor: rgba(245,197,24,0.1)`
- Icon inside: `width:28, height:28`
- Active tint: `colors.gold`
- Inactive tint: `rgba(255,255,255,0.45)`

### Icon naming convention
All icon files in `assets/icons/` follow these patterns:
- Tab bar: `ic_[name]-TAB.png`
- In-screen: `ic_[name].png`
- All at 96×96px, white on transparent background

### Medal/trophy rule
`ic_gold_medal`, `ic_silver_medal`, `ic_bronze_medal`, `ic_trophy` — these have their own colours baked in. **Never apply `tintColor` to these icons.**

---

## 8. App Architecture — Native

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
`expo-secure-store` persists sessions. Users stay logged in until manual sign out.

### Deep linking
- Scheme: `pavilion://`
- `emailRedirectTo`: `pavilion://login`
- Supabase redirect URL: `pavilion://` added
- Cold-start handler: `getLastNotificationResponseAsync` in `App.jsx`
- Background handler: `addNotificationResponseReceivedListener` in `App.jsx`
- Notification tap routing: `fixture_id` in data → `FIXTURE_DETAIL`, else → `NOTIFICATIONS`

### Splash screen
- Component: `SplashV2_Fusion.jsx`
- `MIN_SPLASH_MS = 3500` in `App.jsx`
- Pavilion icon: `78%` inside ring — breathing room from border
- HTCC crest: `108%` — fills circle for clarity
- Both logo rings: `LOGO_SIZE = 80`

### TopHeader
- Pavilion icon: `width:34, height:34, borderRadius:9`
- HTCC crest: `width:42, height:42, borderRadius:11` — no ring, no shadow, matches Pavilion icon style

---

## 9. App Architecture — Web

- React 18 + Vite + TailwindCSS v4
- Auto-deploys to Netlify on git push to main
- Email confirmation redirect: `pavilion://login`
- Known issue: Admin dashboard does not show pending join request approvals — fix pending

---

## 10. PlayCricket Sync Pipeline

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
- Home venue hardcoded as `HTCC, Rayners Lane HA2 9TY`
- Away venue: update manually via staging table process after sync (Section 20)

### calc_awards.py
- Calculates batting + bowling + fielding points per player per match
- Awards POTM to highest scorer per match
- Rebuilds `pc_season_stats` (full DELETE + reinsert)

### Points system (configurable at top of calc_awards.py)
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
- ⚠️ Fielding loop MUST be outside the `bat_counts` loop — nesting multiplied counts, now fixed

---

## 11. Push Notifications

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

---

## 12. What's Live — Feature Inventory

### Member
- [x] Welcome screen — animated CountUp stats, dual logos, est. badge
- [x] Splash — dual logo fusion, typewriter, dual orbit rings
- [x] Signup — phone code dropdown, password strength checker
- [x] Dashboard — week navigator, fixture cards, training, announcements
- [x] Fixture list — filters (upcoming/past, team, home/away, type), canonical team sort
- [x] Fixture detail — Playing XI with position order, C/WK icons, YOU tag
- [x] Teams — fixture carousel, join requests, canonical sort (1st→2nd→3rd→4th→Sunday)
- [x] Stats — batting/bowling/awards tabs, medal rings, team filters, player modal
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
- [x] Training session management — create, delete, recurring
- [x] Announcements — post to all/members/captains/admins
- [x] Matchday overview — availability counts, progress bar, prompt players
- [x] Admin notified on new signup and join requests

### Platform
- [x] Full PNG icon system — AppIcon component, ICON_SCALE, FORCED_TINTS
- [x] Deep linking — `pavilion://` scheme
- [x] Real-time updates all key screens
- [x] Push notifications all events — background and cold-start
- [x] Safe area insets all tab navigators
- [x] Error boundary
- [x] Session persistence
- [x] Account deletion (Apple requirement — full cascade)
- [x] Android adaptive icon with safe zone padding
- [x] Performance — full useMemo / useCallback / React.memo pass

---

## 13. Known Issues & Parking Lot

| Issue | Priority | Notes |
|---|---|---|
| Black screen / freeze on startup or returning from background | ✅ FIXED v1.3.0 | `MIN_SPLASH_MS` corrected to 3500, `AppState` listener added to clear stuck loading gate on foreground return |
| Remaining emojis | ✅ FIXED v1.3.0 | Full audit — zero emojis remaining across all screens and constants |
| Training session edit | ✅ FIXED v1.3.0 | Edit UI built — pre-populated form, single-session update, recurring badge preserved |
| Performance — AdminMembersScreen | ✅ FIXED v1.3.0 | FlatList virtualisation, `windowSize:5`, `removeClippedSubviews`, memoised renderItem |
| Fantasy League | DEFERRED v1.4.0 | Coming Soon screen live — full FPL-style feature planned next |
| PlayCricket official ECB API token | PENDING | Applied for, scraper used as interim |
| Android Play Store listing | IN REVIEW | AAB submitted, awaiting approval |
| Admin web dashboard — pending approvals | PENDING | Join request approvals not showing on web admin dashboard |
| Away fixture venues | MANUAL PROCESS | Update via staging table each season — see Section 20 |

---

## 14. iOS & Android Submission Status

### iOS
| Item | Status |
|---|---|
| Build 3 | ❌ Rejected — missing account deletion |
| Build 4 — v1.2.0 | ✅ Approved and LIVE |
| Build 5 — v1.2.1 | ✅ Approved and LIVE |

**App Store Connect:** `https://appstoreconnect.apple.com/apps/6761196439`
**Bundle ID:** `com.htcc.pavilion`
**Team:** `7T4DG8HHMT`

### Android
| Item | Status |
|---|---|
| AAB — production build | ✅ Built and submitted to Play Store |
| APK — preview build | ✅ Built for sideload distribution |
| Play Store listing | 🔄 In review |

**Play Console:** `https://play.google.com/console/u/0/developers/5496674967732676898/app/4972011997061754233/app-dashboard`
**Package:** `com.htcc.pavilion`
**versionCode:** 5

---

## 15. Completed This Sprint — v1.2.1

| Item | Detail |
|---|---|
| Push notification fix | Background + cold-start handlers, duplicate UIBackgroundModes removed, projectId fallback added |
| Performance — all screens | Full `useMemo` / `useCallback` / `React.memo` pass |
| Performance — double fetch fix | `DashboardScreen` was double-fetching fixtures on mount |
| Deep linking | `"scheme": "pavilion"` in `app.json`, `emailRedirectTo: 'pavilion://login'`, `Linking` listener in `App.jsx`, Supabase redirect URL added |
| Icon system — `src/lib/icons.js` | Central PNG registry — 37 icons mapped by name |
| Icon system — `src/components/AppIcon.jsx` | `ICON_SCALE = 2.2` global multiplier, `FORCED_TINTS` for date/time/venue |
| Icon system — `assets/icons/` | 96×96px white PNG exports for all tab bar + in-screen icons |
| Tab bar icons | Gold ring on focused tab, `width:32, height:32`, gold/45% white tinting |
| Emoji replacement | All screens fully updated — every emoji replaced with AppIcon |
| C/WK badges | `captainBadge` gold tint, `wkBadge` blue tint — icon only, no container |
| Medal rings — StatsScreen | `width:36, height:36` ring with MEDAL_ACCENT border, icon `width:28, height:28` |
| Badge alignment | `alignItems: 'center'` on all tagRow, teamBadge, hwBadge styles across all screens |
| Action button centering | `justifyContent: 'center'` on all squad/remind/edit/delete buttons |
| Splash screen | Pavilion icon `78%` inside ring, HTCC crest `108%`, rings same size |
| TopHeader | Gold ring removed from crest, sized to `42×42px` — matches Pavilion icon style |
| Filter team sort | Canonical order 1st→2nd→3rd→4th→Sunday in `FixturesScreen` |
| `MIN_SPLASH_MS` | Reduced from `6500` to `3500` |
| iOS Build 5 | Submitted and approved — LIVE |
| Android AAB | Built and submitted to Google Play Store |
| Android APK | Built for sideload distribution |
| Google Play Console | Account created, store listing completed |
| Home venue fix | `HTSC` → `HTCC` on all home fixtures via SQL update |
| Away venue fix | Updated via `fixture_venue_staging` staging table — table dropped after |
| Test accounts | All removed — only superadmin remains |
| Player onboarding message | WhatsApp message drafted |
| Welcome announcement | Posted in app for all members |

---

## 16. Completed This Sprint — v1.3.0

| Item | Detail |
|---|---|
| Black screen / freeze fix | `MIN_SPLASH_MS` corrected from 6500 → 3500 (regression from v1.2.1). `AppState` listener added to `App.jsx` — clears stuck `loading` gate if app was backgrounded |
| Emoji audit — complete | Zero emojis remain across all screens, navigators, constants. All replaced with `AppIcon` or plain text |
| Training session edit UI | `AdminTrainingScreen.jsx` — `editingId` state, `handleEditOpen`, `handleUpdate`. Edit button per card. Edit mode shows single-session warning. Recurring toggle hidden in edit mode |
| FlatList virtualisation | `AdminMembersScreen.jsx` — `ScrollView + .map()` replaced with `FlatList`. `windowSize:5`, `removeClippedSubviews`, `maxToRenderPerBatch:8`, memoised `renderItem`, `ListHeaderComponent` for search + filters |
| Fantasy League Coming Soon | `FantasyLeagueScreen.jsx` — full teaser screen with feature cards, points preview, shimmer badge, pulse dots. `FANTASY_LEAGUE` added to `SCREENS` constant |
| Fantasy League tab | Added to `MemberNavigator` — `FantasyTabIcon` component (trophy, no tint), 7th tab between Alerts and Profile |
| Notification titles | All emoji prefixes removed from push/in-app notification titles across all screens |
| Match type labels | `MATCH_TYPE_LABELS` in `constants.js` — emoji prefixes removed. `NOTIF_TYPE_ICON` updated to use icon names from `icons.js` |
| AppIcon in NotificationsScreen | Notification type badge now renders `AppIcon` instead of emoji text |

---

## 17. Next Release — v1.4.0

### Priority 1 — Fantasy League (full build)
Full FPL-style fantasy cricket feature. Coming Soon screen already live.

**Scope:**
- New Supabase tables: `fantasy_teams`, `fantasy_picks`, `fantasy_results`
- `fantasy_teams`: `id`, `member_id`, `team_name` (unique constraint), `total_points`, `created_at`
- `fantasy_picks`: `id`, `fantasy_team_id`, `pc_player_id`, `is_captain`, `is_vice_captain`
- `fantasy_results`: points per player per gameweek, updated after sync
- Member flow: create team (unique name) → pick Best XI → assign C/VC → view leaderboard
- Points: same formula as `calc_awards.py` — captain = 3×, vice-captain = 2×
- Leaderboard screen showing all fantasy teams ranked by total points
- Edit team: swap players, rename (unique check), change C/VC
- Supabase function to recalculate fantasy points after each `calc_awards.py` run

---

### Priority 2 — In-app scorecard submission
Admin/captain submits match scores immediately after a match. Points calculated instantly.

**Scope:**
- `MatchScorecardScreen.jsx` — accessible from `FixtureDetailScreen` or `AdminMatchdayScreen` for published squads only
- Input per player: batting (runs, balls, fours, sixes, how out), bowling (overs, maidens, runs, wickets), fielding (catches, run outs, stumpings)
- On submit: calculate points using same formula as `calc_awards.py`, determine POTM, write to Supabase
- Push notification to squad announcing POTM instantly

**Decision needed before building:**
Write to existing `pc_batting` / `pc_bowling` / `pc_match_points` tables OR maintain a new separate `match_scores` table.

---

### Priority 3 — Team of the Week
Highlight highest-scoring player per position each week.

**Scope:**
- New `pc_team_of_week` Supabase table
- New `calc_team_of_week()` function in `calc_awards.py`
- New section in `StatsScreen` or dedicated screen
- Admin trigger to publish weekly

---

### Priority 4 — Android Play Store
Confirm listing approved and app is live.

---

### Priority 5 — Further performance
- Add `getItemLayout` to FlatLists where row height is fixed
- Reduce Supabase query payload — `select('*')` → select only needed columns
- Reduce real-time channel subscriptions — consolidate where possible
- Lazy load heavy screens (Stats modal, AdminMatchday player list)
- Admin web dashboard — pending join request approvals fix

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

### GitHub Actions (cloud)

```yaml
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

### Build and submit Android (Play Store)
```powershell
eas build --platform android --profile production
eas submit --platform android
```

### After iOS submit — App Store Connect
1. Go to `https://appstoreconnect.apple.com/apps/6761196439`
2. Version page → Build → Add Build → select new build
3. Update **What's New in This Version**
4. Click **Submit for Review** → export compliance → **No**

### Version rules
| Field | Rule |
|---|---|
| `version` | User-facing e.g. `1.2.1` → `1.3.0` |
| `ios.buildNumber` | Must increment every submission e.g. `"5"` → `"6"` |
| `android.versionCode` | Must increment every submission e.g. `5` → `6` |

---

## 19. Android APK — Sideload Build

Use for distributing directly to Android users without Play Store.

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas build --platform android --profile preview
```

EAS produces a `.apk` download link. Share with Android users via WhatsApp. Users tap the link, download the file, tap **Install anyway** when prompted about unknown sources.

**Push notifications work on sideloaded APK** — Expo uses FCM which does not require Play Store distribution. All standard Android phones have Google Play Services.

---

## 20. Fixture Venue Update Process

Used each season to set away venue names after PlayCricket sync.

### Step 1 — Export away fixtures
```sql
SELECT id, match_date, opponent, home_away, venue
FROM fixtures
WHERE home_away = 'away'
ORDER BY match_date;
```
Download as CSV from Supabase SQL editor.

### Step 2 — Fill in venues
Open CSV in Excel/Google Sheets. Replace `TBC` values in the `venue` column. Keep `id` column intact — do not let Excel reformat the UUIDs.

### Step 3 — Upload staging table
In Supabase → Table Editor → New table → name it `fixture_venue_staging`. Import the CSV. Only `id` (text) and `venue` (text) columns are needed.

### Step 4 — Run update
```sql
UPDATE fixtures f
SET venue = s.venue
FROM fixture_venue_staging s
WHERE f.id = s.id::uuid
AND f.home_away = 'away';
```
Note: `::uuid` cast is required because the staging table imports `id` as `text`.

### Step 5 — Drop staging table
```sql
DROP TABLE fixture_venue_staging;
```

### Home venue fix (if needed)
```sql
UPDATE fixtures
SET venue = 'HTCC, Rayners Lane HA2 9TY'
WHERE venue != 'HTCC, Rayners Lane HA2 9TY'
AND home_away = 'home';
```

---

## 21. Critical Rules — Never Break These

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
| Fielding loop outside `bat_counts` loop | Nesting multiplied counts — fixed, never re-nest |
| `useSafeAreaInsets()` on all three tab navigators | Prevents bottom bar overlap on Android + iPhone home indicator |
| `AppIcon ICON_SCALE` | Single value in `AppIcon.jsx` scales ALL in-screen icons — never hardcode sizes in screens |
| `AppIcon FORCED_TINTS` | `date` = gold, `time` = gold, `venue` = blue — change here, updates everywhere |
| Medal/trophy icons | Never apply `tintColor` — they have own colours baked in |
| Tab bar icon sizes | `width:28, height:28` inside `width:32, height:32` ring — set in navigators, not AppIcon |
| `MIN_SPLASH_MS` in `App.jsx` | Currently `3500` |
| Home venue | Always `HTCC, Rayners Lane HA2 9TY` — never `HTSC` |
| Away venue staging cast | Always `s.id::uuid` in update query — staging table imports id as text |

---

## 22. How to Start a New Development Session

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

## 23. Context Block for New Chat Sessions

**Paste this at the start of any new chat:**

---

> I am building **Pavilion HTCC** — a full-stack cricket club management platform for Harrow Town Cricket Club. We have moved away from Pitchero and this is now the club's primary platform from the 2026 season.
>
> **Stack:** Expo SDK 54, React Native, React Navigation v7, Zustand, Supabase (Postgres + RLS + Realtime), Python sync pipeline, React 18 web app on Netlify.
>
> **Paths:**
> - App: `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app\`
> - Web: `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-web\`
> - Sync: `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-sync\`
> - Live web: `https://pavilion-htcc.netlify.app`
>
> **Accounts:** Expo `nishvek10`, Supabase ref `nqhhvataxjaecctvrrzc`, Apple Team `7T4DG8HHMT`, App Store App ID `6761196439`, Bundle ID `com.htcc.pavilion`, Google Play Developer ID `5496674967732676898`
>
> **Current version:** `1.2.1` / Build `5`
> **iOS:** v1.2.1 Build 5 LIVE on App Store
> **Android:** AAB submitted to Play Store (in review), APK available for sideload
>
> **Critical rules:**
> - `toLocalISO()` always, never `.toISOString().split('T')[0]`
> - Valid roles: `pending` `member` `captain` `admin` `superadmin` — rejecting = DELETE profile row
> - Never reinstall `react-native-reanimated`, `react-native-draggable-flatlist`, `react-native-gesture-handler`
> - `squad_members` uses `position_order` not `position`
> - Notification badge clears via Zustand `setUnreadCount` direct mutation
> - `AppIcon ICON_SCALE = 2.2` in `AppIcon.jsx` — single value scales all in-screen icons
> - `AppIcon FORCED_TINTS` — date/time = gold, venue = blue — change here updates everywhere
> - Medal/trophy icons — never apply tintColor, they have own colours
> - `babel.config.js` — only `babel-preset-expo`, no plugins array
> - Admin tab bar at 6-tab limit
> - `MIN_SPLASH_MS = 3500` in `App.jsx`
> - Home venue: always `HTCC, Rayners Lane HA2 9TY`
>
> **Immediate priorities for v1.3.0:**
> 1. **BLACK SCREEN / FREEZE BUG** — app freezes on startup or when returning from background — HIGH PRIORITY — start here
> 2. Remaining emoji audit and replacement
> 3. In-app scorecard submission for admin/captain — batting, bowling, fielding → instant POTM calculation
> 4. Team of the Week feature
> 5. Performance — FlatList virtualisation, query optimisation, lazy loading
> 6. Training session edit UI
> 7. Android Play Store — confirm listing approved and live
>
> **Full detail in:** `pavilion-app/HANDOVER_V2.md`

---

*Last updated: April 2026 — Pavilion v1.2.1 Build 5 — iOS LIVE, Android submitted*
