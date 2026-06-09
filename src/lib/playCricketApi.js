// pavilion-app/src/lib/playCricketApi.js
// Play Cricket API v2 — match detail fetcher + HTCC scorecard parser.
// Used by MatchScorecardScreen to pre-fill batting/bowling/fielding from PC data.
// Player matching: profiles.pc_member_id (bigint) ↔ PC player_id / batsman_id / bowler_id.
// ─────────────────────────────────────────────────────────────────────────────

const PC_API_TOKEN = 'aec28d28822cddd54b8849e1db27180e'
const PC_BASE_URL  = 'https://play-cricket.com/api/v2'

// Keyword used to identify HTCC innings in match_detail response.
// Matched case-insensitively against home_club_name / away_club_name.
const HTCC_CLUB_KEYWORD = 'harrow town'

// ─── Type helpers ─────────────────────────────────────────────────────────────
const toInt = (v) => parseInt(v,  10) || 0
const toFlt = (v) => parseFloat(v)    || 0

// ─── how_out code sets ────────────────────────────────────────────────────────
// Play Cricket how_out codes that mean batter DID NOT BAT — skip entirely, no batting row
const DNB_CODES = new Set(['dnb', 'did not bat', 'absent'])
// Play Cricket how_out codes that mean batter is NOT out (played but unbeaten)
const NOT_OUT_CODES = new Set(['not out', 'no', 'ret no', 'retired not out', 'retired'])
// Play Cricket how_out codes that mean run out (on top of duck penalty)
const RUN_OUT_CODES = new Set(['ro', 'run out', 'run-out', 'runout'])

function parseHowOut(how_out) {
  const code = (how_out || '').toLowerCase().trim()
  const dnb     = DNB_CODES.has(code)
  const not_out = !dnb && NOT_OUT_CODES.has(code)
  const run_out = !dnb && !not_out && (RUN_OUT_CODES.has(code) || code.startsWith('run out'))
  return { dnb, not_out, run_out }
}

// ─── URL / ID → match_id ─────────────────────────────────────────────────────
// Handles:
//   https://play-cricket.com/website/results/1234567
//   https://play-cricket.com/match/detail/1234567
//   bare integer string "1234567"
export function parseMatchIdFromUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  // Pure integer
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10)
  // Extract trailing integer from URL path (5–8 digits)
  const m = trimmed.match(/\/(\d{5,8})\/?(?:[?#].*)?$/)
  return m ? parseInt(m[1], 10) : null
}

// ─── Fetch match_detail from Play Cricket API ─────────────────────────────────
// Throws on network error or bad response.
export async function fetchMatchDetail(matchId) {
  const url = `${PC_BASE_URL}/match_detail.json?match_id=${matchId}&api_token=${PC_API_TOKEN}`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`Play Cricket API error: ${res.status} ${res.statusText}`)
  const json = await res.json()
  const detail = json?.match_details?.[0]
  if (!detail) throw new Error('No match data returned from Play Cricket.')
  return detail
}

// ─── Identify HTCC's team_id in the match ────────────────────────────────────
// Returns string team_id or null if HTCC not found in this match.
export function identifyHtccTeamId(detail) {
  const homeClub = (detail.home_club_name || '').toLowerCase()
  const awayClub = (detail.away_club_name || '').toLowerCase()
  if (homeClub.includes(HTCC_CLUB_KEYWORD)) return String(detail.home_team_id)
  if (awayClub.includes(HTCC_CLUB_KEYWORD)) return String(detail.away_team_id)
  return null
}

// ─── Parse HTCC scorecard from match_detail ───────────────────────────────────
// profilesMap  : Map<pc_member_id (string) → profile_uuid (string)>
//                Built from squad members' profiles.pc_member_id values.
//
// Returns:
//   batting  : { [profile_uuid]: { runs, balls, fours, sixes, not_out, run_out } }
//   bowling  : { [profile_uuid]: { overs, maidens, runs, wickets, no_balls, wides } }
//   fielding : { [profile_uuid]: { catches, stumpings } }
//   matched  : number of player stats successfully linked
//   unmatched: string[] — PC player names with no matching pc_member_id in squad
//
// Logic:
//   HTCC batting innings  → extract bat[] for HTCC batters
//   Opponent batting innings → extract bowl[] for HTCC bowlers
//                           → extract catches/stumpings from fielder_id in bat[]
//
export function parseHtccScorecard(detail, htccTeamId, profilesMap) {
  const batting  = {}
  const bowling  = {}
  const fielding = {}

  let matched   = 0
  const unmatchedSet = new Set()

  const innings = detail.innings || []

  innings.forEach(inn => {
    const isHtccBatting = String(inn.team_batting_id) === String(htccTeamId)

    if (isHtccBatting) {
      // ── HTCC Batting innings ──────────────────────────────────────────────────
      ;(inn.bat || []).forEach(b => {
        const pcId = String(b.batsman_id || '')
        if (!pcId) return

        const pid = profilesMap.get(pcId)
        if (!pid) {
          if (b.batsman_name) unmatchedSet.add(b.batsman_name)
          return
        }

        const { dnb, not_out, run_out } = parseHowOut(b.how_out)
        // Skip players who did not bat — no batting row should exist for them
        if (dnb) return
        batting[pid] = {
          runs:    toInt(b.runs),
          balls:   toInt(b.balls),
          fours:   toInt(b.fours),
          sixes:   toInt(b.sixes),
          not_out,
          run_out,
        }
        matched++
      })

    } else {
      // ── Opponent batting innings → HTCC is bowling + fielding ─────────────────

      // HTCC Bowling
      ;(inn.bowl || []).forEach(bwl => {
        const pcId = String(bwl.bowler_id || '')
        if (!pcId) return

        const pid = profilesMap.get(pcId)
        if (!pid) {
          if (bwl.bowler_name) unmatchedSet.add(bwl.bowler_name)
          return
        }

        bowling[pid] = {
          overs:    toFlt(bwl.overs),
          maidens:  toInt(bwl.maidens),
          runs:     toInt(bwl.runs),
          wickets:  toInt(bwl.wickets),
          no_balls: toInt(bwl.no_balls),
          wides:    toInt(bwl.wides),
        }
        matched++
      })

      // HTCC Fielding — extract catches and stumpings from dismissal records
      ;(inn.bat || []).forEach(b => {
        const howOut    = (b.how_out || '').toLowerCase().trim()
        const fieldPcId = String(b.fielder_id || '')
        if (!fieldPcId) return

        const pid = profilesMap.get(fieldPcId)
        if (!pid) return   // fielder not in squad or not linked — skip silently

        if (!fielding[pid]) fielding[pid] = { catches: 0, stumpings: 0 }
        if (howOut === 'ct') fielding[pid].catches++
        if (howOut === 'st') fielding[pid].stumpings++
      })
    }
  })

  return {
    batting,
    bowling,
    fielding,
    matched,
    unmatched: [...unmatchedSet],
  }
}
