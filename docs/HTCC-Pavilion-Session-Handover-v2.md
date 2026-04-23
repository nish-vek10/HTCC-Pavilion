# HTCC Pavilion — Native App Handover
> Last updated: 15 March 2026 · Covers all pavilion-app development sessions to date
> This document covers the **React Native / Expo mobile app only**.

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

## 3. Confirmed Supabase Enum Values

> ⚠️ These are the ONLY valid `user_role` enum values. Never use others.

| Role | DB value |
|---|---|
| Super Admin | `superadmin` (no underscore) |
| Admin | `admin` |
| Captain | `captain` |
| Member | `member` |
| Awaiting approval | `pending` |

> `super_admin` and `rejected` are NOT valid enum values and will crash queries.

---

## 4. Design System (`src/theme/index.js`)

```js
colors: {
  navy:      '#0D1B2A',
  navyLight: '#162032',
  gold:      '#F5C518',
  green:     '#22C55E',
  red:       '#EF4444',
  blue:      '#60A5FA',   // Sunday fixture + training accent
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

> ⚠️ Never use `fontWeight: '700'` with custom fonts — use `fontFamily: fonts.bold` instead.
> ⚠️ Never use `toISOString().split('T')[0]` for date calculations — use `toLocalISO()` helper (BST/UTC off-by-one issue).

---

## 5. Hard Constraints — Never Break These

- ❌ No `react-native-reanimated` — breaks SDK 54 build
- ❌ No plugins in `babel.config.js` — only `babel-preset-expo`
- ❌ No `fontWeight: '700'` — use `fontFamily: fonts.bold`
- ❌ No `.toISOString().split('T')[0]` for local dates — use `toLocalISO(d)` helper
- ✅ Always `npx expo start --clear` after any package install

---

## 6. `toLocalISO` Helper (use everywhere dates are calculated)

```js
// Prevents BST/UTC off-by-one — use this instead of toISOString().split('T')[0]
function toLocalISO(d) {
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

This is used in: `DashboardScreen`, `AdminMatchdayScreen`, `FixturesScreen`, `AdminFixturesScreen`.

---

## 7. Date Handling Pattern (consistent everywhere)

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
```

**Past/Upcoming cutoff rule:** A fixture is "past" from **Monday 00:00** of the following week. Saturday + Sunday fixtures stay visible all weekend and archive together on Monday morning.

---

## 8. File Structure

```
pavilion-app/
├── app.json
├── eas.json
├── babel.config.js
├── index.js
├── App.jsx                           ← fonts + MIN_SPLASH_MS + auth listener + push token registration
├── assets/
│   ├── pavilion-icon.png
│   └── htcc-logo.png
└── src/
    ├── lib/
    │   ├── supabase.js
    │   ├── constants.js
    │   ├── promptHelper.js           ← fixture availability prompts (in-app + push)
    │   └── pushNotifications.js      ← NEW: central push helper (token, send, insert)
    ├── theme/index.js
    ├── store/authStore.js
    ├── navigation/
    │   ├── RootNavigator.jsx
    │   ├── AuthNavigator.jsx
    │   ├── MemberNavigator.jsx
    │   ├── AdminNavigator.jsx
    │   └── CaptainNavigator.jsx
    ├── components/
    │   ├── layout/TopHeader.jsx
    │   ├── ClubLoader.jsx
    │   ├── ConfirmModal.jsx
    │   └── SplashV1_Orbit.jsx        ← ACTIVE splash
    └── screens/
        ├── public/
        │   ├── WelcomeScreen.jsx
        │   ├── LoginScreen.jsx
        │   ├── SignupScreen.jsx
        │   └── PendingScreen.jsx
        ├── member/
        │   ├── DashboardScreen.jsx   ← HEAVILY UPDATED this session
        │   ├── FixturesScreen.jsx    ← HEAVILY UPDATED this session
        │   ├── TeamsScreen.jsx
        │   ├── NotificationsScreen.jsx ← Updated (new notification types)
        │   ├── ProfileScreen.jsx
        │   └── FixtureDetailScreen.jsx
        ├── admin/
        │   ├── AdminDashboardScreen.jsx
        │   ├── AdminMembersScreen.jsx    ← Updated (push on approve/role/team)
        │   ├── AdminFixturesScreen.jsx   ← Updated (Monday cutoff, picker containers, date modal)
        │   ├── AdminAnnouncementsScreen.jsx ← Updated (push on post)
        │   ├── AdminMatchdayScreen.jsx   ← Updated (tab colours, arrow nav, date fix)
        │   ├── AdminPanelProfileScreen.jsx
        │   ├── AdminTrainingScreen.jsx   ← Updated (date modal, gold title)
        │   ├── AdminTrainingAnnouncementsScreen.jsx
        │   └── TrainingDetailScreen.jsx  ← Updated (push on prompt all, fixed RLS)
        └── captain/
            ├── CaptainFixturesScreen.jsx
            └── SquadSelectionScreen.jsx  ← Updated (push on squad publish)
```

---

## 9. New File This Session — `src/lib/pushNotifications.js`

Central push notification helper. Functions:

| Function | Purpose |
|---|---|
| `registerPushToken(userId)` | Called on login in `App.jsx` — saves `expo_push_token` to `profiles` |
| `sendPushToUser(userId, title, body, data)` | Send push to one user |
| `sendPushToUsers(userIds, title, body, data)` | Send push to multiple users |
| `sendPushToRole(targetRole, title, body, data)` | Send push to all members of a role |
| `insertNotification(userId, type, title, body, extra)` | Insert one in-app notification row |
| `insertNotifications(userIds, type, title, body, extra)` | Insert in-app notifications for multiple users |
| `insertNotificationsForRole(targetRole, type, title, body, extra)` | Insert for all members of a role |

> ⚠️ Push tokens only work on **real devices with EAS production/preview APK builds**. Expo Go does not support push delivery from SDK 53+.

---

## 10. Supabase Schema Changes This Session

### New column
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS fixture_id uuid REFERENCES fixtures(id) ON DELETE CASCADE;
```

### New RLS policy (notifications)
```sql
CREATE POLICY "Admins can insert notifications for any user"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'captain', 'superadmin')
    )
  );
```

### New RLS policy (profiles read)
```sql
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);
```

### Existing tables confirmed
`profiles` · `teams` · `team_members` · `join_requests` · `fixtures` · `availability` · `squads` · `squad_members` · `notifications` · `announcements` · `availability_prompts` · `training_sessions` · `training_availability`

---

## 11. Push Notification Coverage

| Event | File | Recipients |
|---|---|---|
| New announcement posted | `AdminAnnouncementsScreen` | All members matching `target_role` |
| Membership approved | `AdminMembersScreen` | Approved member |
| Promoted to captain/admin | `AdminMembersScreen` | Promoted member |
| Added to a team | `AdminMembersScreen` | Added member |
| Squad published | `SquadSelectionScreen` | All 11 selected players |
| Fixture availability prompt | `promptHelper.js` | Individual player (with `fixture_id` saved) |
| Training prompt all | `TrainingDetailScreen` | All non-responders |

---

## 12. Notification Types & Colours (`NotificationsScreen`)

```js
const TYPE_COLOR = {
  availability_reminder: colors.gold,
  training_reminder:     '#60A5FA',
  squad_published:       colors.green,
  approval:              colors.green,
  role_change:           '#A78BFA',
  team_added:            colors.green,
  announcement:          colors.gold,
  welcome:               '#60A5FA',
  join_approved:         colors.green,
  join_rejected:         colors.red,
  custom:                colors.textMuted,
}
```

Tapping a notification with `fixture_id` navigates to `FixtureDetailScreen`.

---

## 13. DashboardScreen — Key Changes This Session

- **Smart week offset** — on load, scans up to 16 weeks ahead and auto-jumps to first weekend with fixtures
- **Monday cutoff** — `getThisMonday()` used for past/upcoming split
- **`toLocalISO()`** used in `getWeekDates()` — fixes Saturday showing blue in BST
- **Announcements carousel** — `FlatList` horizontal paged with dot indicators + swipe hint
- **Training sessions carousel** — `FlatList` horizontal paged with dot indicators + swipe hint
- **Week navigator** — `‹`/`›` circular arrow buttons (replaced `← Prev` / `Next →`)
- **"This Weekend" label** — bold when active
- **Section titles** — `ANNOUNCEMENTS` and `SESSIONS` uppercase
- **Card titles** — bold + uppercase (announcement title, training session title)
- **Body text** — `textLight` instead of `textMuted` for differentiation from date
- **Saturday sections** — only rendered if fixtures exist (no empty placeholders)
- **`useFocusEffect`** added for training sessions re-fetch on tab focus
- `maintainVisibleContentPosition` on ScrollView (partial fix for jump issue — known limitation)

---

## 14. FixturesScreen — Key Changes This Session

- **`useFocusEffect`** replaces `useEffect` — re-fetches on every tab focus (picks up admin deletes/edits)
- **Monday cutoff** — `isPast()` uses `getThisMondayISO()` not midnight same day
- **Training strip** — compact horizontal `ScrollView` strip (not full-width paged)
  - Cards are `width: SCREEN_W - 96` — wide enough to show content, next card peeks
  - Cards are tappable — opens availability modal (bottom sheet)
  - Status dot on right of card (green/red glow when set, hollow grey ring when not)
  - Modal has Available/Unavailable side-by-side with dot indicator
  - Strip header: "UPCOMING TRAINING" left + "Tap to add availability" (gold) right
- **Training availability state** — `trainingAvail`, `trainingSubmitting`, `trainingModal` in `FixturesScreen`
- Max 8 training sessions shown

---

## 15. AdminMatchdayScreen — Key Changes This Session

- **Date bug fixed** — `toLocalISO()` prevents Thursday/Friday showing on Saturday tab
- **`shiftDate`** — now jumps ±7 days (always stays on same weekday)
- **Tabs** — Saturday: gold border/bg · Sunday: blue border/bg · unselected: coloured border only
- **Date navigator** — `‹`/`›` circular arrows, pill colour matches active tab (gold/blue)
- **Squad position numbers** — fixed `findIndex` on sorted array, shows `•` if not found

---

## 16. AdminFixturesScreen — Key Changes This Session

- **Monday cutoff** for upcoming/past split
- **Delete error handling** — now shows `Alert` on RLS failure instead of silent fail
- **Form picker buttons** — now in proper containers matching `input` style
- **Date picker** — wrapped in `Modal` with backdrop tap-to-dismiss, centered on screen
- **Form title** — "New Fixture" text in gold

---

## 17. AdminTrainingScreen — Key Changes This Session

- **Date picker** — wrapped in `Modal` with backdrop tap-to-dismiss, centered on screen
- **Form title** — "New Training Session" text in gold

---

## 18. TrainingDetailScreen — Key Changes This Session

- **RLS fix** — changed `.not('role', 'in', '(pending,rejected)')` to `.neq('role', 'pending')` (rejected not in enum)
- **`handlePromptAll`** — `try/catch/finally` added (was getting stuck on "Sending reminders…")
- **Push notifications** — `sendPushToUser` called for each non-responder alongside in-app insert
- **Sort order** — Available → Unavailable → Not Responded, each A-Z with null-safe `sortAZ`

---

## 19. Run Commands

```powershell
# Navigate to app root
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app

# Start Expo dev server
npx expo start

# Start with cache cleared (use after package changes)
npx expo start --clear

# Build Android APK (preview profile)
eas build --platform android --profile preview

# Check EAS login
eas whoami

# Login to EAS
eas login
```

---

## 20. Build History

| Version | versionCode | Date | Notes |
|---|---|---|---|
| 1.0.0 | 1 | ~Mar 2026 | Initial APK |
| 1.1.0 | 2 | 15 Mar 2026 | Training sessions, prompts, squad roles |
| 1.2.0 | 3 | 15 Mar 2026 | Push notifications, UI consistency, date fixes, smart week offset |

> Before next build: bump `version` to `1.2.0` and `versionCode` to `3` in `app.json`.

---

## 21. Pending Next Steps (Priority Order)

| Priority | Item | Detail |
|---|---|---|
| 🔴 1 | **Build v1.2.0 APK** | `eas build --platform android --profile preview` — needed for push tokens to register on device |
| 🔴 2 | **Training session — edit functionality** | Only create/delete exists. Add edit button on session cards |
| 🔴 3 | **Fixture auto-import from PlayCricket/MCCL** | Scrape or use PlayCricket API to auto-populate league fixtures — discussed but not implemented |
| 🟡 4 | **Match results & scorecards** | Add result (win/loss/draw + scores) to past fixtures |
| 🟡 5 | **Player statistics** | Appearances, availability rate from `squad_members` + `availability` |
| 🟡 6 | **FixtureDetailScreen C/WK badges** | Verify `is_captain`/`is_wicketkeeper` display correctly |
| 🟡 7 | **Member notifications for training prompts** | `type: 'training_reminder'` handling confirmed in `NotificationsScreen` |
| 🟡 8 | **iOS TestFlight build** | Requires Apple Developer account (£99/yr) |
| 🟡 9 | **Recurring training — edit series** | "Edit just this session" or "Edit all future sessions" |
| 🟢 10 | **Offline state handling** | Graceful error states when Supabase calls fail |
| 🟢 11 | **Deep linking** | Notification tap → specific fixture/training detail |

---

## 22. PlayCricket / MCCL Fixture Import (Research Note)

**Options explored (not implemented):**

1. **PlayCricket API** — `play-cricket.com` has a public API (`api.play-cricket.com/api/v2/`). Requires a free API key (register at play-cricket.com). Can fetch fixtures for a club by site ID. HTCC's site ID needs confirming.

2. **MCCL website scrape** — `middlesexcl.play-cricket.com` — if no API available, a one-time Node.js scraper using `cheerio` could parse fixture tables and POST to Supabase. One-time import, not live sync.

3. **Manual import via CSV** — admin uploads a spreadsheet, app parses and bulk-inserts to `fixtures` table.

> Recommended approach: start with PlayCricket API — register at `https://play-cricket.com/api` and look up HTCC club ID, then build a simple one-time import script in Node.js.

---

## 23. Notes for Next Developer Session

- **Always run `npx expo start --clear` after any package install**
- **Never install `react-native-reanimated`** — causes build failure with SDK 54
- **`babel.config.js` must only have `babel-preset-expo`** — no plugins
- **Date format rule:** Display `DD-MM-YYYY`, store `YYYY-MM-DD`. Use `toISO()` / `toDDMMYYYY()` helpers
- **Always use `toLocalISO(d)`** instead of `d.toISOString().split('T')[0]` for local date strings
- **Monday cutoff pattern:** `getThisMondayISO()` for past/upcoming splits — used in `FixturesScreen`, `AdminFixturesScreen`, `DashboardScreen`
- **Training time smart defaults:** Saturday = 15:00, all other days = 17:30 (`defaultTimeForDate()` in `AdminTrainingScreen`)
- **`embedded` prop pattern:** Pass `embedded={true}` to suppress `TopHeader` in combined screens
- **Admin tab bar has 6 tabs** — already at limit
- **`promptHelper.js`** — single source of truth for fixture availability prompting
- **`pushNotifications.js`** — single source of truth for all push notification logic
- **`expo_push_token`** column exists on `profiles` — saved on every login via `App.jsx`
- **`fixture_id`** column exists on `notifications` — saved by `promptHelper.js` for tap navigation
- **RLS on `notifications`** — `superadmin`, `admin`, `captain` can insert for any user
- **Squad roles:** `is_captain` and `is_wicketkeeper` on `squad_members` — assigned via bottom sheet in `SquadSelectionScreen`
- **Saturday = gold, Sunday = blue** — enforced throughout all screens and nav
