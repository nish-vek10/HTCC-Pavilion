// pavilion-app/src/theme/index.js
// Mirrors the CSS variables in pavilion-web/src/styles/globals.css :root

// ─── Brand colour palette ─────────────────────────────────────────────────────
export const colors = {
  navy:       '#0D1B2A',   // primary background
  navyLight:  '#162032',   // card / surface background
  gold:       '#F5C518',   // primary accent
  green:      '#22C55E',   // available / success
  red:        '#EF4444',   // unavailable / danger
  amber:      '#F5C518',   // tentative (same as gold)
  blue:       '#60A5FA',   // Sunday fixtures
  border:     '#1E3A5F',   // card borders
  textMuted:  '#8B9BB4',   // secondary text
  textLight:  '#CBD5E1',   // body text on navy
  white:      '#FFFFFF',
}

// ─── Font family keys (loaded via expo-font in App.jsx) ───────────────────────
export const fonts = {
  display: 'BebasNeue',      // headings + club name
  body:    'DMSans',         // all body text
  medium:  'DMSans-Medium',  // medium weight
  bold:    'DMSans-Bold',    // bold weight — use this instead of fontWeight: '700'
}

// ─── Spacing scale ────────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
}

// ─── Border radii ─────────────────────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
}

// ─── Common shadow (used on cards) ────────────────────────────────────────────
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
}