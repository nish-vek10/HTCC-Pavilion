# HTCC Pavilion — Native App Handover
> Last updated: 15 March 2026 · Covers all pavilion-app development sessions to date
> This document covers the **React Native / Expo mobile app only**.
> For the web platform, refer to the separate web handover document.

---

## 1. Project Identity

| Item | Value |
|---|---|
| App name | **Pavilion** |
| Club | Harrow Town Cricket Club (HTCC) |
| Superadmin email | anish.vek10@gmail.com |
| Expo account | nishvek10 |
| Native app root | `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app\` |
| Supabase project ref | `nqhhvataxjaecctvrrzc` |
| Supabase URL | `https://nqhhvataxjaecctvrrzc.supabase.co` |
| EAS project ID | `839c48f3-c7a2-4fbd-a9c8-98e76daef60e` |
| Android bundle ID | `com.htcc.pavilion` |
| iOS bundle ID | `com.htcc.pavilion` |
| Live web URL | `https://pavilion-htcc.netlify.app` |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| React version | 19.1.0 |
| React Native version | 0.81.5 |
| Navigation | React Navigation v7 (native stack + bottom tabs) |
| State | Zustand (`authStore.js`) |
| Backend / DB | Supabase JS client (AsyncStorage session) |
| Fonts | expo-font · Bebas Neue · DM Sans |
| Notifications | expo-notifications |
| Secure storage | expo-secure-store |
| Date picker | @react-native-community/datetimepicker |
| Build | EAS Build (Expo Application Services) |
| Deployment | APK distributed via EAS preview profile |

---

## 3. Key `package.json` Dependencies (Locked — do not upgrade without testing)

```json
"expo": "~54.0.0",
"react": "19.1.0",
"react-native": "0.81.5",
"expo-status-bar": "~3.0.9",
"expo-font": "~14.0.11",
"expo-constants": "~18.0.13",
"expo-device": "~8.0.10",
"expo-notifications": "~0.32.16",
"expo-secure-store": "~15.0.8",
"@react-native-async-storage/async-storage": "2.2.0",
"@react-native-community/datetimepicker": "8.4.4",
"@react-navigation/native": "^7.0.14",
"@react-navigation/native-stack": "^7.2.0",
"@react-navigation/bottom-tabs": "^7.2.0",
"@supabase/supabase-js": "^2.49.1",
"react-native-safe-area-context": "5.6.0",
"react-native-screens": "4.16.0",
"react-native-url-polyfill": "^2.0.0",
"zustand": "^4.5.2",
"date-fns": "^4.1.0",
"@expo-google-fonts/bebas-neue": "^0.2.3",
"@expo-google-fonts/dm-sans": "^0.2.3"
```

> ⚠️ `react-native-reanimated`, `react-native-draggable-flatlist`, `react-native-gesture-handler` were tested and removed — do NOT reinstall.

---

## 4. `app.json` (Current — production-ready)

```json
{
  "expo": {
    "name": "Pavilion",
    "slug": "pavilion-htcc",
    "version": "1.1.0",
    "orientation": "portrait",
    "icon": "./assets/pavilion-icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/pavilion-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0D1B2A"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.htcc.pavilion"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/pavilion-icon.png",
        "backgroundColor": "#0D1B2A"
      },
      "package": "com.htcc.pavilion",
      "versionCode": 2
    },
    "plugins": [
      ["expo-notifications", { "icon": "./assets/pavilion-icon.png", "color": "#F5C518" }],
      "expo-font",
      "expo-secure-store",
      "@react-native-community/datetimepicker"
    ],
    "extra": {
      "eas": { "projectId": "839c48f3-c7a2-4fbd-a9c8-98e76daef60e" }
    },
    "owner": "nishvek10"
  }
}
```

---

## 5. `babel.config.js` (Critical — keep exactly as is)

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

> ⚠️ Do NOT add `react-native-reanimated/plugin` — this breaks the build.

---

## 6. `eas.json`

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "appVersionSource": "local"
    }
  }
}
```

---

## 7. Design System / Theme (`src/theme/index.js`)

```js
colors: {
  navy:      '#0D1B2A',
  navyLight: '#162032',
  gold:      '#F5C518',
  green:     '#22C55E',
  red:       '#EF4444',
  blue:      '#60A5FA',   // Sunday fixture accent
  border:    '#1E3A5F',
  textMuted: '#8B9BB4',
  textLight: '#CBD5E1',
  white:     '#FFFFFF',
}

fonts: {
  display: 'BebasNeue',
  body:    'DMSans',
  medium:  'DMSans-Medium',
  bold:    'DMSans-Bold',
}
```

> ⚠️ Never use `fontWeight: '700'` with custom fonts in React Native — use `fontFamily: fonts.bold` instead.

---

## 8. Complete File Structure

```
pavilion-app/
├── app.json
├── eas.json
├── babel.config.js
├── index.js                          ← registerRootComponent(App)
├── App.jsx                           ← fonts + MIN_SPLASH_MS=3200 + auth listener
├── assets/
│   ├── pavilion-icon.png             ← 1024×1024 shield P icon
│   └── htcc-logo.png                 ← HTCC crest
└── src/
    ├── lib/
    │   ├── supabase.js               ← AsyncStorage Supabase client
    │   ├── constants.js              ← ROLES, SCREENS, AVAILABILITY_CONFIG, MATCH_TYPE_LABELS
    │   └── promptHelper.js           ← Shared prompt logic (availability_prompts table)
    ├── theme/index.js
    ├── store/authStore.js            ← Zustand: signIn, signUp, fetchProfile, role helpers
    ├── navigation/
    │   ├── RootNavigator.jsx         ← Auth gate → role-based navigator
    │   ├── AuthNavigator.jsx         ← Welcome → Login → Signup → Pending
    │   ├── MemberNavigator.jsx       ← Bottom tabs + FixtureDetail stack
    │   ├── AdminNavigator.jsx        ← Admin tabs + SquadSelection + TrainingDetail stack
    │   └── CaptainNavigator.jsx      ← Captain tabs + SquadSelection stack
    ├── components/
    │   ├── layout/TopHeader.jsx      ← Pavilion left, HTCC crest right
    │   ├── ClubLoader.jsx
    │   ├── ConfirmModal.jsx
    │   ├── SplashScreen.jsx          ← Points to SplashV1_Orbit
    │   ├── SplashV1_Orbit.jsx        ← ACTIVE: orbit rings, 3.2s minimum
    │   ├── SplashV2_Cinematic.jsx
    │   ├── SplashV3_Assemble.jsx
    │   ├── SplashV4_Typewriter.jsx
    │   └── SplashV5_Minimal.jsx
    └── screens/
        ├── public/
        │   ├── WelcomeScreen.jsx
        │   ├── LoginScreen.jsx
        │   ├── SignupScreen.jsx
        │   └── PendingScreen.jsx
        ├── member/
        │   ├── DashboardScreen.jsx
        │   ├── FixturesScreen.jsx
        │   ├── TeamsScreen.jsx
        │   ├── NotificationsScreen.jsx
        │   ├── ProfileScreen.jsx
        │   └── FixtureDetailScreen.jsx
        ├── admin/
        │   ├── AdminDashboardScreen.jsx
        │   ├── AdminMembersScreen.jsx
        │   ├── AdminFixturesScreen.jsx
        │   ├── AdminAnnouncementsScreen.jsx
        │   ├── AdminMatchdayScreen.jsx
        │   ├── AdminPanelProfileScreen.jsx
        │   ├── AdminTrainingScreen.jsx        ← NEW ✅
        │   ├── AdminTrainingAnnouncementsScreen.jsx  ← NEW ✅ (combined tab)
        │   └── TrainingDetailScreen.jsx       ← NEW ✅
        └── captain/
            ├── CaptainFixturesScreen.jsx
            └── SquadSelectionScreen.jsx
```

---

## 9. Navigation Architecture

### Role-based routing (RootNavigator.jsx)

```
Unauthenticated → AuthNavigator (Welcome → Login → Signup → Pending)

Authenticated:
  All roles → "Member" stack (base)
    ├── MemberNavigator (bottom tabs)
    └── "AdminPanel" stack → AdminNavigator (slides in from right)
    └── "CaptainPanel" stack → CaptainNavigator (slides in from right)
```

### MemberNavigator — Bottom Tabs
| Tab | Screen | Icon |
|---|---|---|
| Home | DashboardScreen | ⚡ |
| Fixtures | FixturesScreen | 📅 |
| Teams | TeamsScreen | HTCC crest |
| Alerts | NotificationsScreen | 🔔 |
| Profile | ProfileScreen | 👤 |

Stack screens above tabs: `FixtureDetailScreen` (slide from bottom)

### AdminNavigator — Bottom Tabs (6 tabs)
| Tab | Screen | Icon |
|---|---|---|
| Overview | AdminDashboardScreen | HTCC crest |
| Matchday | AdminMatchdayScreen | 🏏 |
| Fixtures | AdminFixturesScreen | 📅 |
| Members | AdminMembersScreen | 👥 |
| Sessions | AdminTrainingAnnouncementsScreen | 🏋️ |
| Profile | AdminPanelProfileScreen | 👤 |

Stack screens above tabs: `SquadSelectionScreen` (slide from bottom) · `TrainingDetailScreen` (slide from right)

> **Sessions tab** is a combined screen with a pill toggle switching between Training (default) and Announcements. This was merged to avoid overcrowding the tab bar.

### CaptainNavigator — Bottom Tabs
| Tab | Screen | Icon |
|---|---|---|
| Fixtures | CaptainFixturesScreen | 📅 |
| Profile | AdminPanelProfileScreen (reused) | 👤 |

Stack screens above tabs: `SquadSelectionScreen`

### Navigation to Admin/Captain Panel (from ProfileScreen)
```jsx
// ProfileScreen.jsx — Admin button
onPress={() => navigation.getParent()?.navigate('AdminPanel')}

// ProfileScreen.jsx — Captain button
onPress={() => navigation.getParent()?.navigate('CaptainPanel')}

// AdminPanelProfileScreen.jsx — Back to member view
const handleBackToMember = () => {
  navigation.getParent()?.getParent()?.navigate('Member')
}
```

---

## 10. SCREENS Constants (`src/lib/constants.js`)

```js
export const SCREENS = {
  // Auth
  WELCOME: 'Welcome', LOGIN: 'Login', SIGNUP: 'Signup', PENDING: 'Pending',
  // Member tabs
  DASHBOARD: 'Dashboard', FIXTURES: 'Fixtures', TEAMS: 'Teams',
  NOTIFICATIONS: 'Notifications', PROFILE: 'Profile',
  // Member stack
  FIXTURE_DETAIL: 'FixtureDetail',
  // Admin tabs
  ADMIN_DASHBOARD: 'AdminDashboard', ADMIN_MEMBERS: 'AdminMembers',
  ADMIN_FIXTURES: 'AdminFixtures', ADMIN_ANNOUNCEMENTS: 'AdminAnnouncements',
  ADMIN_MATCHDAY: 'AdminMatchday', ADMIN_TRAINING: 'AdminTraining',
  // Admin stack
  SQUAD_SELECTION: 'SquadSelection', TRAINING_DETAIL: 'TrainingDetail',
  // Captain tabs
  CAPTAIN_FIXTURES: 'CaptainFixtures',
}
```

---

## 11. Database Schema (Full — including all additions)

### Core tables
`profiles` · `teams` · `team_members` · `join_requests` · `fixtures` · `availability` · `squads` · `squad_members` · `notifications` · `announcements`

### Added columns (applied via SQL)

**`squad_members`**
```sql
ALTER TABLE squad_members
  ADD COLUMN IF NOT EXISTS is_captain       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_wicketkeeper  boolean DEFAULT false;
```

### New tables (all applied)

**`availability_prompts`** — tracks who has been prompted per fixture
```sql
CREATE TABLE availability_prompts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id  uuid REFERENCES fixtures(id) ON DELETE CASCADE,
  player_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  prompted_by uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(fixture_id, player_id)
);
ALTER TABLE availability_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and captains can insert prompts"
  ON availability_prompts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read prompts"
  ON availability_prompts FOR SELECT TO authenticated USING (true);
```

**`training_sessions`** — training session management
```sql
CREATE TABLE training_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  venue        text NOT NULL,
  session_date date NOT NULL,
  session_time time NOT NULL,
  parent_id    uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read training sessions"
  ON training_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage training sessions"
  ON training_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**`training_availability`** — player responses to training sessions
```sql
CREATE TABLE training_availability (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status     text CHECK (status IN ('available', 'unavailable')),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, player_id)
);
ALTER TABLE training_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can manage own training availability"
  ON training_availability FOR ALL TO authenticated
  USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
CREATE POLICY "Admins can read all training availability"
  ON training_availability FOR SELECT TO authenticated USING (true);
```

---

## 12. Key Feature Implementations

### 12.1 Splash Screen (SplashV1_Orbit — ACTIVE)
- File: `src/components/SplashV1_Orbit.jsx`
- Looping orbit rings, HTCC crest springs in, PAVILION slides up, 3 pulsing dots
- `MIN_SPLASH_MS = 3200` in `App.jsx`
- Shows until fonts loaded AND timer elapsed
- **Android centering fix:** All title text uses `textAlign: 'center'` and `alignSelf: 'stretch'` to prevent letterSpacing offset on non-iOS devices

### 12.2 Profile Screen (`src/screens/member/ProfileScreen.jsx`)
- Role badge shows two lines: title (e.g. SUPER ADMIN) + sub (e.g. FULL PLATFORM ACCESS)
- Admin Panel button: blue tinted container, appears under MY PROFILE heading
- Captain Panel button: green tinted container, appears under MY PROFILE heading
- Navigation uses `navigation.getParent()?.navigate('AdminPanel')`

### 12.3 Squad Selection (`src/screens/captain/SquadSelectionScreen.jsx`)
- Player pool sorted A–Z
- Flexible squad size (no hard 11-player limit for saving — can publish partial squads)
- **Role assignment:** Tap player name → bottom sheet modal → assign Captain (C) or Wicketkeeper (WK)
  - Only one captain and one WK enforced — auto-replaces previous holder
  - Publish blocked with clear error if C or WK not assigned
- **Reordering:** Long-press to pick up player → golden highlight → tap any position to drop
- **Prompt button:** No-reply players show blue "Prompt" button → grey "Prompted" after first prompt → re-prompt modal on second tap
- Save Draft and Publish both navigate back to fixtures after confirmation
- `is_captain` and `is_wicketkeeper` stored in `squad_members` table

### 12.4 Availability Prompts (`src/lib/promptHelper.js`)
- Shared between `AdminMatchdayScreen` and `SquadSelectionScreen`
- Persisted in `availability_prompts` Supabase table (not local state)
- `fetchPromptedPlayers(fixtureId)` — returns map of `{fixtureId_playerId: true}`
- `sendPromptNotification(fixtureId, playerId, promptedBy)` — upserts prompt record + inserts notification
- Both screens use `useFocusEffect` to re-sync prompted state on navigation return

### 12.5 Admin Matchday Screen (`src/screens/admin/AdminMatchdayScreen.jsx`)
- Sat/Sun tab toggle + date navigator (prev/next by 7 days)
- Per-player Prompt button for no-reply players (blue → grey → re-prompt modal)
- Re-prompt confirmation modal: red Cancel + green Prompt Again buttons
- Shows squad position number badge for players already in squad

### 12.6 Admin Fixtures Screen (`src/screens/admin/AdminFixturesScreen.jsx`)
- Past fixtures collapsed into "Past Fixtures Archive" toggle section
- Add/Edit fixture form with date picker (DD-MM-YYYY display, YYYY-MM-DD stored)
- Date picker: `@react-native-community/datetimepicker` inline dark mode, gold accent
- Navigate to Squad Selection per fixture

### 12.7 Training Sessions (NEW ✅)

**AdminTrainingScreen** (`src/screens/admin/AdminTrainingScreen.jsx`)
- Create single or recurring weekly sessions
- Date picker: DD-MM-YYYY display, inline dark calendar with gold accent
- Smart time defaults: Saturday → 15:00, all other days → 17:30 (overridable)
- Recurring: generates all weekly occurrences up to end date using `addWeeks`
- Sessions grouped by month
- Delete: single session or entire recurring series

**AdminTrainingAnnouncementsScreen** (`src/screens/admin/AdminTrainingAnnouncementsScreen.jsx`)
- Combined screen for the "Sessions" admin tab
- Pill toggle: Training (default, gold) ↔ Announcements (purple)
- Uses `useSafeAreaInsets()` for safe area on both iOS and Android
- Both child screens rendered with `embedded={true}` prop to hide TopHeader

**TrainingDetailScreen** (`src/screens/admin/TrainingDetailScreen.jsx`)
- 2×2 stats grid: Total Players · Available · Unavailable · Not Responded
- Progress bar (green/red/grey proportional)
- Single "Prompt All Non-Responders" button (prompts only those who haven't responded)
- Players grouped in sections: Available · Unavailable · Not Responded (each A–Z)
- Pull to refresh

**Member view — DashboardScreen training section**
- Training sessions shown under Announcements
- Blue tinted cards with date block, title, venue, time
- Available / Unavailable toggle per session
- Toggle-off supported (tapping active status removes response)

**Member view — FixturesScreen training strip**
- Horizontal scroll strip showing upcoming training sessions
- Blue tinted mini-cards showing date, title, time, venue

### 12.8 Date Handling Pattern (Consistent across all admin forms)
```js
// Display format: DD-MM-YYYY (user-facing)
// Storage format: YYYY-MM-DD (Supabase)

const toISO = (dd_mm_yyyy) => {
  const [dd, mm, yyyy] = dd_mm_yyyy.split('-')
  return `${yyyy}-${mm}-${dd}`
}
const toDDMMYYYY = (date) => {
  const dd   = String(date.getDate()).padStart(2, '0')
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}
const isoToDisplay = (iso) => {
  const [yyyy, mm, dd] = iso.split('-')
  return `${dd}-${mm}-${yyyy}`
}
```

---

## 13. Admin Panel Profile Screen (`src/screens/admin/AdminPanelProfileScreen.jsx`)

- Reused by both AdminNavigator and CaptainNavigator Profile tab
- **"Back to Member View"** gold button under MY PROFILE heading
- Same profile edit functionality as member ProfileScreen
- Role badge shows two lines (label + description)

---

## 14. Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Admin/Captain panels as root stack screens | Avoids nested navigator conflicts; clean slide-in/out transition |
| Training + Announcements combined tab | Prevents 7-tab overcrowding on admin nav bar |
| PanResponder drag removed | Unreliable on Android; replaced with pick-and-place (long press + tap) |
| No react-native-reanimated | Dependency chain causes build failures with SDK 54; native PanResponder used instead |
| `availability_prompts` table | Persists prompted state across navigation; shared between Matchday and SquadSelection |
| `training_sessions.parent_id` | Links recurring occurrences to parent; delete parent cascades to all |
| DD-MM-YYYY display | Consistent with UK date convention across all admin forms |

---

## 15. Bug Fixes Applied (This Session)

| # | Issue | Fix |
|---|---|---|
| 1 | `date-fns` missing | `npm install date-fns --legacy-peer-deps` |
| 2 | `navigation` prop doesn't exist on ProfileScreen | Added `{ navigation }` prop to component signature |
| 3 | Admin panel navigation crash | Used `navigation.getParent()?.navigate('AdminPanel')` |
| 4 | PAVILION text off-centre on Samsung | Added `textAlign: 'center'` + `alignSelf: 'stretch'` to splash title |
| 5 | `react-native-worklets/plugin` error | Removed reanimated entirely; deleted `babel.config.js` plugin entry |
| 6 | `countStatus` duplicate in AdminMatchday | Removed accidental duplicate from copy-paste insertion |
| 7 | Prompted state reset on navigation | Moved prompted state to Supabase `availability_prompts` table |
| 8 | Squad counter showing `3` not `3/11` | Changed `{selected.length}` to `{selected.length}/11` |
| 9 | Single session insert using wrong variable | Fixed `{ data: parent, error: parentErr }` → `{ error: singleErr }` |
| 10 | Training date picker `datePickerField` stale | Unified state to `datePickerField` with correct `session_date`/`end_date` values |

---

## 16. Run Commands

```powershell
# Navigate to app root
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app

# Start Expo dev server
npx expo start

# Start with cache cleared (use after package changes)
npx expo start --clear

# Check EAS login
eas whoami

# Login to EAS
eas login

# Build Android APK (preview profile)
eas build --platform android --profile preview
```

---

## 17. Build History

| Version | versionCode | Date | Notes |
|---|---|---|---|
| 1.0.0 | 1 | ~Mar 2026 | Initial APK — full member + admin/captain screens |
| 1.1.0 | 2 | 15 Mar 2026 | Training sessions, date pickers, prompt system, squad roles (C/WK), archive |

Latest APK build:
`https://expo.dev/accounts/nishvek10/projects/pavilion-htcc/builds/`

---

## 18. Supabase Configuration

| Setting | Value |
|---|---|
| Email confirmation | OFF (re-enable before go-live) |
| Site URL | `https://pavilion-htcc.netlify.app` |
| Realtime | Enabled on `notifications` table |
| Auth session storage | AsyncStorage (mobile) |

---

## 19. Pending Next Steps (Priority Order)

| Priority | Item | Detail |
|---|---|---|
| 🔴 1 | **Push notifications (EAS production build)** | `expo_push_token` already saved in `profiles`. Need EAS production build (not preview) to register push tokens on device. Implement `sendPushNotification` server-side function to trigger on squad published, availability reminders etc. |
| 🔴 2 | **Training session — edit functionality** | Currently only create/delete. Add edit button on session cards to modify title, venue, date, time. |
| 🔴 3 | **Training availability in admin detail** | `TrainingDetailScreen` fetches all profiles. Confirm RLS allows admin to read all `training_availability` rows (not just own). Test with multiple members. |
| 🟡 4 | **iOS TestFlight build** | Requires Apple Developer account (£99/year). Bundle ID `com.htcc.pavilion` already set. Use `eas build --platform ios --profile preview` once enrolled. |
| 🟡 5 | **Member notifications for training prompts** | `sendPromptNotification` inserts to `notifications` table. Member `NotificationsScreen` should surface these — confirm `type: 'training_reminder'` is handled in the notifications screen UI. |
| 🟡 6 | **Match results & scorecards** | Add result (win/loss/draw + scores) to past fixtures. Visible on fixture detail and team stats. |
| 🟡 7 | **Player statistics** | Appearances count, availability rate, matches played per member. Aggregate from `squad_members` + `availability` tables. |
| 🟡 8 | **Fixture detail — published squad display** | `FixtureDetailScreen` shows published squad. Verify C and WK badges display correctly next to player names using `is_captain` / `is_wicketkeeper` columns. |
| 🟢 9 | **Version bump workflow** | Before each APK build: increment `version` in `app.json` and increment `versionCode`. Current: `1.1.0` / `2`. |
| 🟢 10 | **Recurring training — edit series** | When editing a recurring session, prompt: "Edit just this session" or "Edit all future sessions". |
| 🟢 11 | **Offline state handling** | Add graceful error states when Supabase calls fail (no internet). Currently errors are silent or crash. |
| 🟢 12 | **Deep linking** | Link from notification tap directly to fixture detail or training session detail. Currently notifications navigate generically. |

---

## 20. Notes for Next Developer Session

- **Always run `npx expo start --clear` after any package install** — Metro cache causes stale module errors
- **Never install `react-native-reanimated`** — causes `react-native-worklets/plugin` build failure with SDK 54
- **`babel.config.js` must only have `babel-preset-expo`** — no plugins
- **Date format rule:** Display as `DD-MM-YYYY` to users, store as `YYYY-MM-DD` in Supabase. Use `toISO()` / `toDDMMYYYY()` helpers in `AdminFixturesScreen` and `AdminTrainingScreen`
- **Training time smart defaults:** Saturday = 15:00, all other days = 17:30. Logic in `defaultTimeForDate()` in `AdminTrainingScreen`
- **`embedded` prop pattern:** When a screen is rendered inside `AdminTrainingAnnouncementsScreen`, pass `embedded={true}` to suppress `TopHeader`
- **Admin tab bar has 6 tabs max** — already at limit. Merge any new admin sections into existing tabs or use stack navigation
- **`promptHelper.js`** is the single source of truth for all availability prompting — both `AdminMatchdayScreen` and `SquadSelectionScreen` import from it
- **Squad roles:** `is_captain` and `is_wicketkeeper` columns exist on `squad_members`. SquadSelectionScreen handles assignment via bottom sheet modal. `FixtureDetailScreen` should display these badges — verify this is implemented
