# PlayCricket → Supabase Fixture Importer
## Pavilion App — Harrow Town Cricket Club

---

## Overview

Scrapes HTCC's full season fixture list from `harrowtown.play-cricket.com`
and upserts them into the Supabase `fixtures` table.

- **No API key required** — scrapes the public PlayCricket website directly
- **Safe to re-run** — uses `playcricket_id` as a dedup key, never creates duplicates
- **Dry run mode** — preview all fixtures before any data is written
- **81 fixtures live in Supabase** for the 2026 season across all 5 teams (confirmed 16 Mar 2026)

---

## File Structure

```
scripts/playcricket/
├── __init__.py                  ← Python package marker (empty)
├── .env                         ← Your credentials (never commit this)
├── .env.example                 ← Credential template (safe to commit)
├── config.py                    ← All configurable settings
├── scraper.py                   ← Core HTML scraping + parsing logic
├── import_fixtures.py           ← Entry point — orchestrates scrape + upsert
├── debug_html/                  ← Auto-created — raw HTML dumps for debugging
└── README.md                    ← This file
```

---

## Prerequisites

1. Python 3.11+
2. Dependencies installed (see Setup below)
3. Supabase **service role** key — from **Supabase Dashboard → Settings → API → service_role (secret)**
4. SQL migration run in Supabase (see Setup below)

> ⚠️ Must use the **service_role** key, NOT the anon/public key.
> The anon key will fail with an RLS policy violation error.

> ⚠️ No PlayCricket API key needed for the scraper. If/when the official API token
> arrives from ECB, see the **API Token (Future)** section below.

---

## One-Time Setup

### 1 — Install dependencies

```powershell
pip install requests beautifulsoup4 supabase python-dotenv lxml
```

### 2 — Create your `.env` file

Copy `.env.example` to `.env` in the same folder and fill in:

```env
SUPABASE_URL=https://nqhhvataxjaecctvrrzc.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

> The service role key bypasses RLS — keep it secret, never commit `.env` to git.

### 3 — Run SQL migration in Supabase SQL Editor (once only)

```sql
-- Adds PlayCricket match ID column for upsert deduplication
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS playcricket_id integer UNIQUE;
```

---

## Running the Importer

### Standard run (writes to Supabase)

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
python -m scripts.playcricket.import_fixtures
```

### Dry run (preview only — nothing written)

In `config.py` set:
```python
DRY_RUN = True
```
Then run the same command. The full fixture table prints but nothing is upserted.

### Debug run (saves raw HTML for inspection)

In `config.py` set:
```python
DEBUG_SAVE_HTML = True
DRY_RUN         = True
```
Raw HTML pages are saved to `debug_html/` — useful if parsing breaks after
PlayCricket updates their site layout.

---

## Configuration Reference (`config.py`)

All user-adjustable settings live at the top of `config.py`.

| Setting | Current value | Description |
|---|---|---|
| `PC_BASE_URL` | `https://harrowtown.play-cricket.com` | Club's PlayCricket subdomain |
| `PC_SITE_ID` | `3199` | Numeric site ID (confirmed from homepage footer) |
| `PC_SEASON_ID` | `259` | PlayCricket internal season ID for 2026 |
| `PC_SEASON_MONTHS` | `[4, 5, 6, 7, 8, 9]` | Months to scrape (Apr–Sep) |
| `PC_TEAMS` | 5 teams | Dict of team label → PlayCricket team ID |
| `HTCC_CLUB_NAME` | `"Harrow Town"` | Used for home/away detection |
| `SEASON_START_DATE` | `"2026-05-09"` | First official league match day — pre-season excluded |
| `DRY_RUN` | `False` | Set `True` to preview without writing |
| `DEBUG_SAVE_HTML` | `False` | Set `True` to dump raw HTML to `debug_html/` |
| `REQUEST_DELAY` | `1.0` | Seconds between HTTP requests (be polite) |

---

## Team IDs Reference

| Team | PlayCricket Team ID | Supabase UUID | URL |
|---|---|---|---|
| 1st XI | `140947` | `07904e9f-e3b6-4cc4-a462-f34e78ff6383` | harrowtown.play-cricket.com/Teams/140947 |
| 2nd XI | `140948` | `c746bb72-4f01-4c25-9834-10b27fc26e90` | harrowtown.play-cricket.com/Teams/140948 |
| 3rd XI | `29087` | `76d9bd44-8c97-4548-b1f4-867d7b56eaca` | harrowtown.play-cricket.com/Teams/29087 |
| 4th XI | `162815` | `94e8a30f-3e97-46b4-b743-05a3fc5e9fe2` | harrowtown.play-cricket.com/Teams/162815 |
| Sunday XI | `213914` | `8e95b8d9-ce28-45a1-901e-87aa4fd1ce81` | harrowtown.play-cricket.com/Teams/213914 |

---

## Club & Site Reference

| Item | Value | Source |
|---|---|---|
| Site slug | `harrowtown` | Subdomain |
| Numeric site ID | `3199` | Homepage footer + `dataLayer` in page source |
| 2026 Season ID | `259` | Fixtures URL `?season_id=259` |

---

## Supabase Schema Mapping

| Scraper field | Supabase column | Type | Notes |
|---|---|---|---|
| `playcricket_id` | `playcricket_id` | `integer` | Unique — dedup key for upserts |
| `match_date` | `match_date` | `date` | YYYY-MM-DD |
| `match_time` | `match_time` | `time` | HH:MM — defaults to `13:00` if missing |
| `opponent` | `opponent` | `text` | Cleaned per naming rules below |
| `home_away` | `home_away` | `text` | `home` or `away` |
| `match_type` | `match_type` | `enum` | `league`, `sunday_comp`, `cup`, `friendly` |
| `day_type` | `day_type` | `enum` | `saturday` or `sunday` |
| `venue` | `venue` | `text` | Home: `HTSC, Rayners Lane HA2 9TY` / Away: `TBC` |
| `team_id` | `team_id` | `uuid` | Resolved from `TEAM_UUID_MAP` in `config.py` |

---

## Opponent Naming Rules

The scraper applies consistent formatting rules to all opponent names before saving:

| HTCC Team | Opponent format | Example |
|---|---|---|
| 1st XI | Club name only | `Uxbridge CC` |
| 2nd XI | Club name only | `Stoke Newington CC` |
| 3rd XI | Club name + opponent XI number | `Harrow CC 3XI` |
| 4th XI | Club name + opponent XI number | `Kay Plus CC 3XI` |
| Sunday XI | Club name only | `Brentham CC` |

**Additional rules applied to all teams:**
- Geographic suffixes stripped — `", Middlesex"`, `", Middx"`, `", Hertfordshire"` etc.
- Special abbreviation: `Middlesex Titans Sports & Social Club` → `MTSSC`
- To add more abbreviations: edit `CLUB_ABBREVIATIONS` dict in `scraper.py`
- To add more geo suffixes: edit `GEO_SUFFIXES` list in `scraper.py`

---

## ✅ 2026 Season — Confirmed Live Import (16 March 2026)

```
Run time  : 2026-03-16 02:05:43
Season    : 259
Scraped   : 81 unique fixtures
Upserted  : 81 rows → Supabase
```

| Stat | Value |
|---|---|
| Total fixtures in Supabase | 81 |
| Pre-season excluded (May 2nd vs Uxbridge) | 3 |
| Saturday league fixtures | 72 |
| Sunday XI fixtures | 9 |
| Season range | 9 May 2026 → 5 September 2026 |
| Home venue | `HTSC, Rayners Lane HA2 9TY` |
| Away venue | `TBC` (admin updates via app when confirmed) |
| Early season kick-off | `12:30` (May – mid Aug) |
| Late season kick-off | `12:00` (mid Aug – Sep) |

---

## ⚙️ New Season Checklist (do this every April)

When the new cricket season starts, follow these steps to re-import fixtures:

### Step 1 — Find the new Season ID

1. Go to `https://harrowtown.play-cricket.com/Matches`
2. In the season dropdown, select the new year
3. Note the `season_id=` value in the URL
4. Update `config.py`:
   ```python
   PC_SEASON_ID = "NEW_ID_HERE"   # e.g. "285" for 2027
   ```

### Step 2 — Update SEASON_START_DATE

Update the first official league match day in `config.py`:
```python
SEASON_START_DATE = "2027-05-XX"   # first MCCL Saturday of new season
```
This ensures pre-season friendlies are excluded automatically.

### Step 3 — Check team IDs still valid

Team IDs rarely change but verify each team URL still resolves:
```
https://harrowtown.play-cricket.com/Teams/140947   ← should show 1st XI page
```
If a team ID has changed, update `PC_TEAMS` in `config.py`.

### Step 4 — Check for new teams

If HTCC adds a 5th XI or a new Sunday team, add it to both `PC_TEAMS` in
`config.py` and `TEAM_UUID_MAP` (get new UUID from Supabase teams table):
```python
PC_TEAMS = {
    ...
    "5th XI": "NEW_PLAYCRICKET_TEAM_ID",
}
TEAM_UUID_MAP = {
    ...
    "5th XI": "NEW_SUPABASE_UUID",
}
```
Also add to `SHOW_XI_TEAMS` in `scraper.py` if opponent XI numbers should show.

### Step 5 — Dry run first

```python
DRY_RUN = True
```
Run and verify the preview table looks correct before writing.

### Step 6 — Live run

```python
DRY_RUN = False
```
Run. Existing fixtures from previous seasons are unaffected (different `playcricket_id`).

### Step 7 — If parsing breaks (PlayCricket changed their layout)

1. Set `DEBUG_SAVE_HTML = True` in `config.py`
2. Run in dry run mode
3. Open any file from `debug_html/` and search for a known match ID
4. Inspect the surrounding HTML structure
5. Update the selectors in `parse_fixtures_from_page()` in `scraper.py`:
   - Date header: currently `div.title2`
   - Match card: currently `div.card-table`
   - Team names: currently `p.txt1` (first = home, second = away)
   - Time: currently `p.time`
   - Ground: currently `p.location > a`

---

## PlayCricket API Token (Future Upgrade)

An official API token from ECB is pending (requested via helpdesk).
When it arrives:

1. Add to `.env`:
   ```env
   PLAYCRICKET_API_TOKEN=your_token_here
   ```
2. The API endpoint for fixtures is:
   ```
   GET https://www.play-cricket.com/api/v2/sites/3199/matches.json
       ?api_token=YOUR_TOKEN&season=2026
   ```
3. A separate `import_fixtures_api.py` script can be built using
   `PC_SITE_ID = "3199"` already defined in `config.py`
4. The scraper version remains as fallback — both use the same
   `playcricket_id` dedup key so they are fully interchangeable

---

## Next Steps / Pending Items

| Priority | Item | Notes |
|---|---|---|
| 🔴 | **Away venue enrichment** | MCCL website is JS-rendered — away venues currently `TBC`. Admin updates via app or manual SQL when confirmed |
| 🟡 | **API token integration** | Build `import_fixtures_api.py` once ECB sends token — more reliable than scraping |
| 🟡 | **Scheduled re-import** | Consider a monthly cron job or GitHub Action to auto-refresh fixtures each season |
| 🟢 | **Historical seasons** | Find season IDs for 2024/2025 and backfill past fixtures for player stats |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `RLS policy violation` | Using anon key instead of service role key | Get **service_role** key from Supabase → Settings → API. Never use the anon key |
| `0 fixtures scraped` | PlayCricket changed HTML layout | Set `DEBUG_SAVE_HTML=True`, inspect `debug_html/`, fix selectors in `scraper.py` |
| `No div.title2 found` | Empty month (normal for April) or layout change | Check saved HTML — if month is genuinely empty, ignore |
| `column not found` | Column name mismatch with Supabase schema | Run schema check SQL, compare against fixture dict in `scraper.py` |
| `Missing env variable` | `.env` not created or wrong key used | Copy `.env.example` → `.env`, fill in **service_role** key (not anon) |
| Opponent name wrong | New club not in abbreviations | Add to `CLUB_ABBREVIATIONS` or `GEO_SUFFIXES` in `scraper.py` |
| HTTP 403 / blocked | PlayCricket rate-limited | Increase `REQUEST_DELAY` in `config.py` (try `2.0`) |
| Pre-season included | `SEASON_START_DATE` not set correctly | Set to first official MCCL Saturday in `config.py` |

---

*_Last updated: March 2026_*