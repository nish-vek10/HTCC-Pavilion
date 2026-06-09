// pavilion-app/src/lib/fantasyPoints.js
// Fantasy League points calculator.
// Mirrors MatchScorecardScreen.jsx POTM formula exactly — keep both in sync.

const int = (v) => parseInt(v, 10)  || 0
const dec = (v) => parseFloat(v)    || 0

// ─── POTM constants — must match MatchScorecardScreen.jsx ─────────────────────
export const POTM = {
  // Batting
  RUN:            1,
  FOUR_BONUS:     2,
  SIX_BONUS:      4,
  NOT_OUT:        5,
  NOT_OUT_MIN:   30,
  MILESTONE_25:  10,
  MILESTONE_50:  20,
  MILESTONE_100: 40,
  DUCK_PEN:      -5,
  RUN_OUT_PEN:   -8,
  // Bowling
  WICKET:        25,
  MAIDEN:         5,
  THREE_WKT:     10,
  FOUR_WKT:      15,
  FIVE_WKT:      30,
  WIDE_PEN:      -1,
  NB_PEN:        -2,
  ECO_PEN_7:     -2,
  ECO_PEN_8:     -3,
  ECO_PEN_9:     -5,
  ECO_PEN_10:    -8,
  // Fielding
  CATCH:         10,
  STUMPING:      10,
}

// Captain ×3 · Vice-Captain ×2
export const MULTIPLIER = { CAPTAIN: 3, VC: 2 }

/**
 * Calculate raw POTM points for one player in one match.
 * @param {object|null} bat   — row from match_batting  (null = did not bat)
 * @param {object|null} bowl  — row from match_bowling  (null = did not bowl)
 * @param {object|null} field — row from match_fielding (null = no fielding)
 * @returns {{ batting: number, bowling: number, fielding: number, total: number }}
 */
export function calcPlayerPoints(bat, bowl, field) {
  let batting = 0, bowling = 0, fielding = 0

  // ── Batting ─────────────────────────────────────────────────────────────────
  if (bat) {
    const runs  = int(bat.runs)
    const fours = int(bat.fours)
    const sixes = int(bat.sixes)
    batting += runs  * POTM.RUN
    batting += fours * POTM.FOUR_BONUS
    batting += sixes * POTM.SIX_BONUS
    if (bat.not_out && runs >= POTM.NOT_OUT_MIN) batting += POTM.NOT_OUT
    if      (runs >= 100) batting += POTM.MILESTONE_100 + POTM.MILESTONE_50 + POTM.MILESTONE_25
    else if (runs >= 50)  batting += POTM.MILESTONE_50  + POTM.MILESTONE_25
    else if (runs >= 25)  batting += POTM.MILESTONE_25
    // Duck — must have faced ≥1 ball or be run out to qualify
    if (runs === 0 && !bat.not_out && (int(bat.balls) > 0 || bat.run_out)) batting += POTM.DUCK_PEN
    // Run out additional penalty
    if (bat.run_out && !bat.not_out) batting += POTM.RUN_OUT_PEN
  }

  // ── Bowling ─────────────────────────────────────────────────────────────────
  if (bowl) {
    const wickets = int(bowl.wickets)
    const maidens = int(bowl.maidens)
    bowling += wickets * POTM.WICKET
    bowling += maidens * POTM.MAIDEN
    bowling += int(bowl.wides)    * POTM.WIDE_PEN
    bowling += int(bowl.no_balls) * POTM.NB_PEN
    const oversRaw = dec(bowl.overs)
    if (oversRaw > 0) {
      const oversActual = (Math.floor(oversRaw) * 6 + Math.round((oversRaw - Math.floor(oversRaw)) * 10)) / 6
      const eco = int(bowl.runs) / oversActual
      if      (eco >= 10) bowling += POTM.ECO_PEN_10
      else if (eco >= 9)  bowling += POTM.ECO_PEN_9
      else if (eco >= 8)  bowling += POTM.ECO_PEN_8
      else if (eco >= 7)  bowling += POTM.ECO_PEN_7
    }
    if      (wickets >= 5) bowling += POTM.FIVE_WKT + POTM.FOUR_WKT + POTM.THREE_WKT
    else if (wickets >= 4) bowling += POTM.FOUR_WKT  + POTM.THREE_WKT
    else if (wickets >= 3) bowling += POTM.THREE_WKT
  }

  // ── Fielding ────────────────────────────────────────────────────────────────
  if (field) {
    fielding += int(field.catches)   * POTM.CATCH
    fielding += int(field.stumpings) * POTM.STUMPING
  }

  return { batting, bowling, fielding, total: batting + bowling + fielding }
}

/** Apply captain (×3) or vice-captain (×2) multiplier to raw total. */
export function applyMultiplier(rawPts, isCaptain, isVC) {
  if (isCaptain) return rawPts * MULTIPLIER.CAPTAIN
  if (isVC)      return rawPts * MULTIPLIER.VC
  return rawPts
}
