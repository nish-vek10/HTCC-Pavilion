// pavilion-web/src/lib/constants.js

// ─── CONFIGURABLE: App identity ───────────────────
export const APP_NAME = 'Pavilion'
export const CLUB_NAME = 'Harrow Town Cricket Club'
export const CLUB_SHORT = 'HTCC'
export const CLUB_FOUNDED = 1921

// ─── User roles (must match Supabase enum exactly) ─
export const ROLES = {
  PENDING:      'pending',
  MEMBER:       'member',
  CAPTAIN:      'captain',
  ADMIN:        'admin',
  SUPERADMIN:   'superadmin',
}

// ─── Role hierarchy (higher = more access) ────────
export const ROLE_LEVEL = {
  pending:    0,
  member:     1,
  captain:    2,
  admin:      3,
  superadmin: 4,
}

// ─── Availability statuses ────────────────────────
export const AVAILABILITY = {
  AVAILABLE:   'available',
  UNAVAILABLE: 'unavailable',
  TENTATIVE:   'tentative',
  NONE:        null,
}

// ─── Availability display config ──────────────────
export const AVAILABILITY_CONFIG = {
  available: {
    label:     'Available',
    color:     '#22C55E',
    fillColor: 'rgba(34,197,94,0.15)',
    dotClass:  'status-dot--available',
    pillClass: 'avail-pill--available',
  },
  unavailable: {
    label:     'Unavailable',
    color:     '#EF4444',
    fillColor: 'rgba(239,68,68,0.15)',
    dotClass:  'status-dot--unavailable',
    pillClass: 'avail-pill--unavailable',
  },
  tentative: {
    label:     'Tentative',
    color:     '#F5C518',
    fillColor: 'rgba(245,197,24,0.15)',
    dotClass:  'status-dot--tentative',
    pillClass: 'avail-pill--tentative',
  },
}

// ─── Teams ────────────────────────────────────────
export const TEAMS = {
  FIRST:   '1st XI',
  SECOND:  '2nd XI',
  THIRD:   '3rd XI',
  FOURTH:  '4th XI',
  SUNDAY:  'Sunday XI',
}

export const DAY_TYPES = {
  SATURDAY: 'saturday',
  SUNDAY:   'sunday',
}

// ─── Match types ──────────────────────────────────
export const MATCH_TYPES = {
  LEAGUE:       'league',
  CUP:          'cup',
  FRIENDLY:     'friendly',
  SUNDAY_COMP:  'sunday_comp',
}

export const MATCH_TYPE_LABELS = {
  league:      '🏆 MCCL',
  cup:         '🏅 Cup',
  friendly:    '🤝 Friendly',
  sunday_comp: '☀️ CVSL',
}

// ─── Squad size ───────────────────────────────────
export const SQUAD_SIZE = 11

// ─── Notification types ───────────────────────────
export const NOTIF_TYPES = {
  AVAILABILITY_REMINDER: 'availability_reminder',
  SQUAD_PUBLISHED:       'squad_published',
  APPROVAL:              'approval',
  WELCOME:               'welcome',
  JOIN_APPROVED:         'join_approved',
  JOIN_REJECTED:         'join_rejected',
  CUSTOM:                'custom',
}

// ─── Route paths ──────────────────────────────────
export const ROUTES = {
  // Public
  LANDING:  '/',
  LOGIN:    '/login',
  SIGNUP:   '/signup',
  PENDING:  '/pending',

  // Member
  DASHBOARD: '/dashboard',
  FIXTURES:  '/fixtures',
  FIXTURE:   '/fixture/:id',
  TEAMS:     '/teams',
  PROFILE:   '/profile',
  SQUAD_VIEW:'/squad/:id',

  // Captain
  CAPTAIN_FIXTURE: '/captain/fixture/:id',
  CAPTAIN_SQUAD:   '/captain/squad/:id',
  CAPTAIN_NEW:     '/captain/fixtures/new',

  // Admin
  ADMIN_DASHBOARD:      '/admin',
  ADMIN_MATCHDAY:       '/admin/matchday/:date',
  ADMIN_FIXTURE:        '/admin/fixture/:id',
  ADMIN_MEMBERS:        '/admin/members',
  ADMIN_FIXTURES:       '/admin/fixtures',
  ADMIN_ANNOUNCEMENTS:  '/admin/announcements',
}

// ─── Browser tab titles ───────────────────────────
export const PAGE_TITLES = {
  LANDING:             'Pavilion · HTCC',
  LOGIN:               'Pavilion · Sign In',
  SIGNUP:              'Pavilion · Join HTCC',
  PENDING:             'Pavilion · Awaiting Approval',
  DASHBOARD:           'Pavilion · Home',
  FIXTURES:            'Pavilion · Fixtures',
  TEAMS:               'Pavilion · My Teams',
  PROFILE:             'Pavilion · Profile',
  CAPTAIN_AVAIL:       'Pavilion · Availability Board',
  CAPTAIN_SQUAD:       'Pavilion · Squad Selector',
  ADMIN_OVERVIEW:      'Pavilion · Admin Overview',
  ADMIN_DASHBOARD:     'Pavilion · Admin Overview',  // alias used by AdminDashboardPage
  ADMIN_MATCHDAY:      'Pavilion · Matchday — Admin',
  ADMIN_FIXTURES:      'Pavilion · Fixtures — Admin',
  ADMIN_MEMBERS:       'Pavilion · Members — Admin',
  ADMIN_ANNOUNCEMENTS: 'Pavilion · Announcements — Admin',
}