# scripts/playcricket/config.py
# ─────────────────────────────────────────────────────────────────────────────
# Configuration for PlayCricket → Supabase fixture importer (scraper mode).
# All user-adjustable settings live at the top of this file.
# ─────────────────────────────────────────────────────────────────────────────

import os
from dotenv import load_dotenv

# Load .env from same directory as this file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ─── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL         = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# ─── PlayCricket Site ─────────────────────────────────────────────────────────
PC_BASE_URL  = "https://harrowtown.play-cricket.com"
PC_SITE_ID   = "3199"  # Confirmed from homepage footer + dataLayer
PC_SEASON_ID = "259"   # 2025 season — update if season ID changes next year

# HTCC team IDs — sourced from harrowtown.play-cricket.com/Teams/<id>
# Key = friendly label used in Pavilion app, Value = PlayCricket team ID
PC_TEAMS = {
    "1st XI":    "140947",
    "2nd XI":    "140948",
    "3rd XI":    "29087",
    "4th XI":    "162815",
    "Sunday XI": "213914",
}

# Cricket season months to scrape (April=4 through September=9)
PC_SEASON_MONTHS = [4, 5, 6, 7, 8, 9]

# HTCC club name as it appears on PlayCricket (used for home/away detection)
HTCC_CLUB_NAME = "Harrow Town"

# ─── Team UUID Map ────────────────────────────────────────────────────────────
# Maps PlayCricket team label → Supabase teams.id (UUID)
# These UUIDs are fixed — only change if teams table is rebuilt
TEAM_UUID_MAP = {
    "1st XI":    "07904e9f-e3b6-4cc4-a462-f34e78ff6383",
    "2nd XI":    "c746bb72-4f01-4c25-9834-10b27fc26e90",
    "3rd XI":    "76d9bd44-8c97-4548-b1f4-867d7b56eaca",
    "4th XI":    "94e8a30f-3e97-46b4-b743-05a3fc5e9fe2",
    "Sunday XI": "8e95b8d9-ce28-45a1-901e-87aa4fd1ce81",
}

# ─── Import Behaviour ─────────────────────────────────────────────────────────
# Set True on first run to save raw HTML files — use to verify/fix selectors
DEBUG_SAVE_HTML = False

# Set True to preview fixtures without writing anything to Supabase
DRY_RUN = False

# Seconds to wait between HTTP requests (be polite to PlayCricket servers)
REQUEST_DELAY = 1.0

# ─── Season Filter ────────────────────────────────────────────────────────────
# Only import fixtures ON or AFTER this date (YYYY-MM-DD).
# Set to the first official league match day to exclude pre-season friendlies.
# Set to None to import everything scraped (no date filter applied).
#
# 2026 MCCL season starts: 09 May 2026
SEASON_START_DATE = "2026-05-09"   # Update each April for the new season

# ─── HTTP Request Headers ─────────────────────────────────────────────────────
# Mimic a real browser to avoid being blocked
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ─── Logging ──────────────────────────────────────────────────────────────────
VERBOSE = True