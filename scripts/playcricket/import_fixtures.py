# scripts/playcricket/import_fixtures.py
# ─────────────────────────────────────────────────────────────────────────────
# Pavilion — PlayCricket Fixture Importer (scraper mode, no API key needed)
# ─────────────────────────────────────────────────────────────────────────────
# Entry point. Run from pavilion-app/ root:
#   python -m scripts.playcricket.import_fixtures
#
# First run: set DEBUG_SAVE_HTML = True in config.py
#            Check debug_html/ folder — share an HTML file if parsing breaks
# Real run:  set DRY_RUN = False, DEBUG_SAVE_HTML = False in config.py
# ─────────────────────────────────────────────────────────────────────────────

import sys
from datetime import datetime
from supabase import create_client, Client

from scripts.playcricket.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    DRY_RUN,
    VERBOSE,
    PC_SEASON_ID,
    TEAM_UUID_MAP,
    DEBUG_SAVE_HTML,
)
from scripts.playcricket.scraper import scrape_all_fixtures


# ─────────────────────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def validate_config():
    """Ensure Supabase credentials are present before attempting any DB writes."""
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    if missing:
        print(f"\n❌ Missing environment variables: {', '.join(missing)}")
        print("   Copy .env.example → .env and fill in your Supabase credentials.\n")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# SUPABASE UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def upsert_fixtures(supabase: Client, fixtures: list[dict]) -> int:
    """
    Upsert fixture rows into Supabase `fixtures` table.
    Uses playcricket_id as the conflict key — safe to re-run multiple times.
    Returns count of rows affected.
    """
    if not fixtures:
        return 0
    try:
        response = (
            supabase.table("fixtures")
            .upsert(fixtures, on_conflict="playcricket_id")
            .execute()
        )
        return len(response.data)
    except Exception as e:
        print(f"❌ Supabase upsert error: {e}")
        return 0


# ─────────────────────────────────────────────────────────────────────────────
# REPORTING
# ─────────────────────────────────────────────────────────────────────────────

def print_preview_table(fixtures: list[dict]):
    """Print a clean preview table of all scraped fixtures."""
    from datetime import date as date_type
    from scripts.playcricket.scraper import determine_match_type

    # Sort by date
    sorted_f = sorted(fixtures, key=lambda x: x.get("date") or "")

    col = {
        "date": 12, "team": 10, "type": 12,
        "h_a": 5, "opponent": 35, "venue": 22, "time": 6
    }

    header = (
        f"  {'DATE':<{col['date']}} {'TEAM':<{col['team']}} {'TYPE':<{col['type']}} "
        f"{'H/A':<{col['h_a']}} {'OPPONENT':<{col['opponent']}} "
        f"{'VENUE':<{col['venue']}} {'TIME':<{col['time']}}"
    )
    divider = "─" * len(header)

    print(f"\n{divider}")
    print(header)
    print(divider)

    for f in sorted_f:
        # Resolve team label from UUID for display purposes
        team_display = next(
            (label for label, uid in TEAM_UUID_MAP.items() if uid == f.get("team_id")),
            f.get("day_type") or "?"
        )
        print(
            f"  {(f.get('match_date') or 'N/A'):<{col['date']}} "
            f"{team_display:<{col['team']}} "
            f"{(f.get('match_type') or ''):<{col['type']}} "
            f"{(f.get('home_away') or ''):<{col['h_a']}} "
            f"{(f.get('opponent') or ''):<{col['opponent']}} "
            f"{(f.get('venue') or ''):<{col['venue']}} "
            f"{(f.get('match_time') or 'TBC'):<{col['time']}}"
        )

    print(divider)


def print_summary(total_scraped: int, total_upserted: int):
    """Print final run summary."""
    print("\n" + "═" * 55)
    print("  PAVILION — FIXTURE IMPORT SUMMARY")
    print("═" * 55)
    print(f"  Run time       : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Season         : {PC_SEASON_ID}")
    print(f"  Scraped        : {total_scraped} unique fixtures")
    print(f"  Upserted       : {total_upserted} rows → Supabase")
    if DRY_RUN:
        print("\n  ⚠️  DRY RUN MODE — nothing was written to Supabase")
    if DEBUG_SAVE_HTML:
        print("\n  ℹ️  DEBUG HTML saved to scripts/playcricket/debug_html/")
        print("      Inspect these files to verify/fix selectors if needed.")
    print("═" * 55 + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("\n🏏  Pavilion — PlayCricket Fixture Importer")
    print(f"    Mode    : {'DRY RUN (no writes)' if DRY_RUN else 'LIVE (writing to Supabase)'}")
    print(f"    Debug   : {'HTML files will be saved' if DEBUG_SAVE_HTML else 'Off'}")

    # Step 1 — Validate Supabase credentials exist (even for dry run, check early)
    validate_config()

    # Step 2 — Scrape all fixtures from PlayCricket
    fixtures = scrape_all_fixtures()

    if not fixtures:
        print("\n⚠️  No fixtures were scraped.")
        print("    If DEBUG_SAVE_HTML = True, check debug_html/ for the raw HTML.")
        print("    If files are empty, the page may require JavaScript (contact us).")
        print_summary(0, 0)
        return

    # Step 3 — Preview the full fixture table
    print_preview_table(fixtures)

    # Step 4 — Write to Supabase (unless dry run)
    upserted = 0
    if not DRY_RUN:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("⬆️   Upserting to Supabase...")
        upserted = upsert_fixtures(supabase, fixtures)
        print(f"✅   {upserted} fixture(s) upserted successfully")

    # Step 5 — Final summary
    print_summary(len(fixtures), upserted)


if __name__ == "__main__":
    main()