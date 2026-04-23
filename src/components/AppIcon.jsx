// pavilion-app/src/components/AppIcon.jsx
// Reusable icon component — renders any icon from the central registry
// tint: applies tintColor (white icons only) — omit for medal/trophy icons
// FORCED_TINTS: overrides tint globally for specific icons — change here, updates everywhere

import React from 'react'
import { Image } from 'react-native'
import icons from '../lib/icons'

// ─── Configurable: global scale multiplier ────────────────────────────────────
// Increase this to scale ALL in-screen icons up at once without touching any screen
const ICON_SCALE = 2.2

// ─── Configurable: forced tint overrides per icon name ───────────────────────
// Any icon listed here always uses this colour regardless of the tint prop passed
// Change a colour here and it updates across every screen automatically
const FORCED_TINTS = {
  date:  '#F5C518',   // gold  — matches fixture date number colour
  time:  '#F5C518',   // gold  — matches fixture date number colour
  venue: '#60A5FA',   // blue  — matches training session date number colour
}

export default function AppIcon({ name, size = 20, tint, style }) {
  const scaledSize   = Math.round(size * ICON_SCALE)
  const resolvedTint = FORCED_TINTS[name] ?? tint

  return (
    <Image
      source={icons[name]}
      style={[
        { width: scaledSize, height: scaledSize },
        resolvedTint ? { tintColor: resolvedTint } : null,
        style,
      ]}
      resizeMode="contain"
    />
  )
}