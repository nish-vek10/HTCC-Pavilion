// pavilion-app/src/lib/constants.js
// Mirrors pavilion-web/src/lib/constants.js exactly

// ─── App identity ─────────────────────────────────────────────────────────────
export const APP_NAME     = 'Pavilion'
export const CLUB_NAME    = 'Harrow Town Cricket Club'
export const CLUB_SHORT   = 'HTCC'
export const CLUB_FOUNDED = 1921

// ─── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = {
  PENDING:    'pending',
  MEMBER:     'member',
  CAPTAIN:    'captain',
  ADMIN:      'admin',
  SUPERADMIN: 'superadmin',
}

// ─── Role hierarchy ───────────────────────────────────────────────────────────
export const ROLE_LEVEL = {
  pending:    0,
  member:     1,
  captain:    2,
  admin:      3,
  superadmin: 4,
}

// ─── Availability ─────────────────────────────────────────────────────────────
export const AVAILABILITY = {
  AVAILABLE:   'available',
  UNAVAILABLE: 'unavailable',
  TENTATIVE:   'tentative',
  NONE:        null,
}

export const AVAILABILITY_CONFIG = {
  available: {
    label:     'Available',
    color:     '#22C55E',
    fillColor: 'rgba(34,197,94,0.15)',
  },
  unavailable: {
    label:     'Unavailable',
    color:     '#EF4444',
    fillColor: 'rgba(239,68,68,0.15)',
  },
  tentative: {
    label:     'Tentative',
    color:     '#F5C518',
    fillColor: 'rgba(245,197,24,0.15)',
  },
}

// ─── Match types — always displayed in caps ───────────────────────────────────
export const MATCH_TYPE_LABELS = {
  league:      'MCCL',
  cup:         'CUP',
  friendly:    'FRIENDLY',
  sunday_comp: 'CVSL',
}

// ─── Team colours — canonical palette, used everywhere a team name → colour ───
// 1st XI = Gold, 2nd XI = Blue, 3rd XI = Green, 4th XI = Purple, Sunday = Orange
export const TEAM_COLOURS = {
  '1st XI':   '#F5C518',   // gold
  '2nd XI':   '#60A5FA',   // blue
  '3rd XI':   '#22C55E',   // green
  '4th XI':   '#A78BFA',   // purple
  'Sunday XI':'#F97316',   // orange
}

// Normalise any casing variation → Title Case  (e.g. "MOHIT singh TanWar" → "Mohit Singh Tanwar")
export function toTitleCase(name) {
  if (!name) return name
  return name.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Helper — returns the canonical colour for a team name string
export function teamColor(name) {
  if (!name) return '#8B9BB4'
  if (name.includes('1st'))                  return TEAM_COLOURS['1st XI']
  if (name.includes('2nd'))                  return TEAM_COLOURS['2nd XI']
  if (name.includes('3rd'))                  return TEAM_COLOURS['3rd XI']
  if (name.includes('4th'))                  return TEAM_COLOURS['4th XI']
  if (name.toLowerCase().includes('sunday')) return TEAM_COLOURS['Sunday XI']
  return '#8B9BB4'
}

// Short display name for a team — used in compact badges
export function shortTeam(name) {
  if (!name) return ''
  if (name.toLowerCase().includes('sunday')) return 'Sun XI'
  const m = name.match(/(\d+(?:st|nd|rd|th) XI)/i)
  return m ? m[1] : name.split(' ')[0]
}

// ─── Squad size ───────────────────────────────────────────────────────────────
export const SQUAD_SIZE = 11

// ─── Notification type icons — icon names from icons.js, resolved in NotificationsScreen ──
export const NOTIF_TYPE_ICON = {
  availability_reminder: 'cricketBat',
  squad_published:       'cricketBat',
  approval:              'approve',
  welcome:               'approve',
  join_approved:         'approve',
  join_rejected:         'reject',
  potm:                  'trophy',
  fantasy_unlocked:      'trophy',
  fantasy_reminder:      'trophy',
  training_reminder:     'training',
  role_change:           'approve',
  team_added:            'approve',
  announcement:          'send',
  custom:                'send',
}

// ─── Screen name constants — used by all navigators ───────────────────────────
export const SCREENS = {
  // Auth
  WELCOME:          'Welcome',
  LOGIN:            'Login',
  SIGNUP:           'Signup',
  PENDING:          'Pending',
  CHECK_EMAIL:      'CheckEmail',
  FORGOT_PASSWORD:  'ForgotPassword',
  RESET_PASSWORD:   'ResetPassword',

  // Member
  DASHBOARD:     'Dashboard',
  FIXTURES:      'Fixtures',
  TEAMS:         'Teams',
  NOTIFICATIONS: 'Notifications',
  PROFILE:       'Profile',

  // Admin
  ADMIN_DASHBOARD:     'AdminDashboard',
  ADMIN_MATCHDAY:      'AdminMatchday',
  ADMIN_FIXTURES:      'AdminFixtures',
  MATCH_SCORECARD: 'MatchScorecard',
  ADMIN_MEMBERS:       'AdminMembers',
  ADMIN_ANNOUNCEMENTS: 'AdminAnnouncements',
  ADMIN_TRAINING:   'AdminTraining',
  TRAINING_DETAIL:  'TrainingDetail',

  // Captain
  CAPTAIN_FIXTURES:  'CaptainFixtures',
  CAPTAIN_MATCHDAY:  'CaptainMatchday',
  CAPTAIN_TRAINING:  'CaptainTraining',
  SQUAD_SELECTION:   'SquadSelection',
  FIXTURE_DETAIL:    'FixtureDetail',
  STATS:             'Stats',

  // Fantasy
  FANTASY_LEAGUE:   'FantasyLeague',
}