# scripts/playcricket/scraper.py
# ─────────────────────────────────────────────────────────────────────────────
# PlayCricket HTML Scraper — rewritten against confirmed real HTML structure
# ─────────────────────────────────────────────────────────────────────────────
# Real page structure (confirmed from debug HTML):
#
#   <div class="title2">Saturday 02 May 2026</div>    ← DATE HEADER
#   <div class="card-table">                           ← MATCH BLOCK
#     <div class="row">
#       <p class="time">12:30</p>
#       <p class="location"><a>Park Road</a></p>
#       <a href="/match_details?id=7475895">           ← MATCH ID
#       <table class="table">
#         <p class="txt1">Uxbridge CC - 1st XI</p>     ← HOME TEAM
#         <p class="txt1">Harrow Town CC - 1st XI</p>  ← AWAY TEAM
#
# Strategy: find all div.title2 date headers → walk to next sibling
#           div.card-table → extract match fields from known selectors.
# ─────────────────────────────────────────────────────────────────────────────

import os
import re
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup

from scripts.playcricket.config import (
    PC_BASE_URL,
    PC_SEASON_ID,
    PC_TEAMS,
    PC_SEASON_MONTHS,
    HTCC_CLUB_NAME,
    TEAM_UUID_MAP,
    DEBUG_SAVE_HTML,
    REQUEST_DELAY,
    REQUEST_HEADERS,
    VERBOSE,
    SEASON_START_DATE,
)

# Folder to dump raw HTML files when DEBUG_SAVE_HTML is True
DEBUG_DIR = os.path.join(os.path.dirname(__file__), "debug_html")

# ─────────────────────────────────────────────────────────────────────────────
# OPPONENT NAME CLEANING — constants
# ─────────────────────────────────────────────────────────────────────────────

# Geographic suffixes to strip from club names (case-insensitive)
GEO_SUFFIXES = [
    ", middlesex", ", middx", ", essex", ", surrey", ", hertfordshire",
    ", herts", ", kent", ", berkshire", ", berks", ", bucks",
    ", buckinghamshire", ", oxfordshire",
]

# Clubs with special abbreviations — full name → abbreviation
CLUB_ABBREVIATIONS = {
    "middlesex titans sports & social club": "MTSSC",
}

# HTCC team labels that show opponent XI number in the fixture display
SHOW_XI_TEAMS = {"3rd XI", "4th XI"}

# Ordinal → digit map for XI formatting: "3rd XI" → "3XI"
ORDINAL_TO_DIGIT = {
    "1st": "1", "2nd": "2", "3rd": "3", "4th": "4",
    "5th": "5", "6th": "6", "7th": "7", "8th": "8",
}


# ─────────────────────────────────────────────────────────────────────────────
# HTTP FETCH
# ─────────────────────────────────────────────────────────────────────────────

def fetch_page(url: str) -> str | None:
    """
    Fetch a PlayCricket page and return raw HTML as a string.
    Returns None on any HTTP or connection error.
    Respects REQUEST_DELAY between calls to avoid hammering the server.
    """
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=20)
        response.raise_for_status()
        time.sleep(REQUEST_DELAY)
        return response.text
    except requests.exceptions.HTTPError as e:
        print(f"   ❌ HTTP error for {url}: {e}")
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Connection error — check your internet for {url}")
    except requests.exceptions.Timeout:
        print(f"   ❌ Timeout for {url}")
    return None


def save_debug_html(html: str, team_label: str, month: int):
    """Save raw HTML to debug_html/ for manual inspection (DEBUG_SAVE_HTML only)."""
    os.makedirs(DEBUG_DIR, exist_ok=True)
    safe_label = team_label.replace(" ", "_")
    filepath = os.path.join(DEBUG_DIR, f"{safe_label}_month{month}.html")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    if VERBOSE:
        print(f"   💾 Debug HTML → {filepath}")


# ─────────────────────────────────────────────────────────────────────────────
# URL BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_fixtures_url(team_id: str, month: int) -> str:
    """Build PlayCricket fixtures page URL for a given team and month."""
    return (
        f"{PC_BASE_URL}/Matches"
        f"?tab=Fixture"
        f"&selected_season_id={PC_SEASON_ID}"
        f"&season_id={PC_SEASON_ID}"
        f"&team_id={team_id}"
        f"&view_by=month"
        f"&fixture_month={month}"
        f"&home_or_away=both"
    )


# ─────────────────────────────────────────────────────────────────────────────
# DATE / TIME PARSING
# ─────────────────────────────────────────────────────────────────────────────

MONTH_MAP = {
    "jan": 1,  "feb": 2,  "mar": 3,  "apr": 4,
    "may": 5,  "jun": 6,  "jul": 7,  "aug": 8,
    "sep": 9,  "oct": 10, "nov": 11, "dec": 12,
}

def parse_pc_date(raw_date: str) -> str | None:
    """
    Parse PlayCricket date strings into YYYY-MM-DD.
    Confirmed real formats from page:
      "Saturday 02 May 2026"
      "02 May 2026"
    Also handles:
      "02/05/2026"
    """
    raw = raw_date.strip()

    # Format: "Saturday 02 May 2026" or "02 May 2026"
    match = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", raw)
    if match:
        dd, mon_str, yyyy = match.groups()
        mon = MONTH_MAP.get(mon_str[:3].lower())
        if mon:
            return f"{int(yyyy)}-{mon:02d}-{int(dd):02d}"

    # Format: "02/05/2026"
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if match:
        dd, mm, yyyy = match.groups()
        return f"{int(yyyy)}-{int(mm):02d}-{int(dd):02d}"

    return None


def parse_pc_time(raw_time: str) -> str | None:
    """
    Normalise PlayCricket time strings to HH:MM.
    Confirmed real format: "12:30"
    """
    if not raw_time:
        return None
    raw = raw_time.strip()
    match = re.match(r"^(\d{1,2}):(\d{2})", raw)
    if match:
        hh, mm = match.groups()
        return f"{int(hh):02d}:{mm}"
    return None


# ─────────────────────────────────────────────────────────────────────────────
# HTML PARSING — PlayCricket real structure
# ─────────────────────────────────────────────────────────────────────────────

def extract_match_id_from_href(href: str) -> int | None:
    """Extract numeric match ID from a match_details URL."""
    match = re.search(r"match_details\?id=(\d+)", href or "")
    return int(match.group(1)) if match else None


def normalise_raw_name(raw: str) -> str:
    """
    Basic normalisation of a p.txt1 team name from PlayCricket HTML.
    Collapses whitespace and normalises dash spacing.
    e.g. "Uxbridge CC  -  1st XI" → "Uxbridge CC - 1st XI"
    """
    cleaned = re.sub(r"\s+", " ", raw).strip()
    cleaned = re.sub(r"\s*-\s*", " - ", cleaned)
    return cleaned


def split_club_and_xi(full_name: str) -> tuple[str, str]:
    """
    Split a full PlayCricket team name into (club_name, xi_label).
    "Uxbridge CC - 1st XI"        → ("Uxbridge CC", "1st XI")
    "West Harrow CC - Saturday 2nd XI" → ("West Harrow CC", "Saturday 2nd XI")
    "Graces CC - Graces XI"       → ("Graces CC", "Graces XI")
    "SomeClub"                    → ("SomeClub", "")
    """
    if " - " in full_name:
        parts = full_name.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    return full_name.strip(), ""


def strip_geo_suffix(club_name: str) -> str:
    """
    Remove geographic qualifiers from a club name.
    "Friends United CC, Middlesex" → "Friends United CC"
    "Enfield CC, Middx"            → "Enfield CC"
    Comparison is case-insensitive.
    """
    lower = club_name.lower()
    for suffix in GEO_SUFFIXES:
        if lower.endswith(suffix):
            return club_name[:len(club_name) - len(suffix)].strip()
    return club_name


def abbreviate_club(club_name: str) -> str:
    """
    Apply any special club abbreviations defined in CLUB_ABBREVIATIONS.
    "Middlesex Titans Sports & Social Club" → "MTSSC"
    """
    return CLUB_ABBREVIATIONS.get(club_name.lower(), club_name)


def format_xi_suffix(xi_label: str) -> str:
    """
    Convert PlayCricket XI label to compact suffix format.
    "1st XI"         → "1XI"
    "3rd XI"         → "3XI"
    "Saturday 2nd XI"→ "2XI"   (strip day prefix)
    "Sunday 1st XI"  → "1XI"   (strip day prefix)
    "Graces XI"      → ""      (non-standard — drop)
    Returns "" if no recognisable ordinal found.
    """
    for ordinal, digit in ORDINAL_TO_DIGIT.items():
        if ordinal.lower() in xi_label.lower():
            return f"{digit}XI"
    return ""


def clean_opponent(raw_opponent: str, htcc_team_label: str) -> str:
    """
    Clean and format an opponent name according to Pavilion display rules:

    - Always strip geographic suffixes (", Middlesex", ", Middx" etc.)
    - Always apply special abbreviations (MTSSC etc.)
    - 1st XI / 2nd XI / Sunday XI → club name only (no XI suffix)
    - 3rd XI / 4th XI             → club name + opponent XI number (e.g. "3XI")

    Examples:
      "Chiswick CC - 4th XI"          + "3rd XI"    → "Chiswick CC 4XI"
      "Friends United CC, Middlesex - 1st XI" + "1st XI" → "Friends United CC"
      "Brentham CC - Sunday 1st XI"   + "Sunday XI" → "Brentham CC"
      "Middlesex Titans Sports & Social Club - 3rd XI" + "4th XI" → "MTSSC 3XI"
    """
    normalised        = normalise_raw_name(raw_opponent)
    club_raw, xi_raw  = split_club_and_xi(normalised)

    # Apply geo stripping and abbreviation to club part
    club = abbreviate_club(strip_geo_suffix(club_raw))

    # Decide whether to append XI suffix
    if htcc_team_label in SHOW_XI_TEAMS and xi_raw:
        xi_suffix = format_xi_suffix(xi_raw)
        if xi_suffix:
            return f"{club} {xi_suffix}"

    return club


def determine_home_away(home_team: str, away_team: str) -> str:
    """
    Determine HTCC's home/away status by checking which team name
    contains HTCC_CLUB_NAME (case-insensitive).
    First p.txt1 = home team, second p.txt1 = away team on PlayCricket.
    """
    if HTCC_CLUB_NAME.lower() in home_team.lower():
        return "home"
    if HTCC_CLUB_NAME.lower() in away_team.lower():
        return "away"
    # Fallback: assume home (will be visible in preview — easy to spot/fix)
    return "home"


def get_opponent(home_team: str, away_team: str, home_or_away: str, htcc_team_label: str) -> str:
    """
    Return the cleaned opponent name.
    Passes the raw opponent string and HTCC's team label to clean_opponent()
    so the correct display format is applied per team.
    """
    raw = away_team if home_or_away == "home" else home_team
    return clean_opponent(raw, htcc_team_label)


def determine_match_type(date_iso: str, team_label: str) -> str:
    """
    Map fixture to a valid Supabase match_type enum value.

    Valid enum values: 'league', 'cup', 'friendly', 'sunday_comp'

    Rules:
      - Sunday XI always → 'sunday_comp'
      - Saturday fixtures (1st–4th XI) → 'league'
      - Mid-week fixtures → 'friendly'
      - Pre-season friendlies are excluded upstream by SEASON_START_DATE
        so any remaining fixture hitting this function is a league game.
    """
    # Sunday XI is always a Sunday competition regardless of date
    if team_label == "Sunday XI":
        return "sunday_comp"

    try:
        dt  = datetime.strptime(date_iso, "%Y-%m-%d")
        day = dt.strftime("%A").lower()
        if day == "saturday":
            return "league"
        # Mid-week games (cup, friendlies — not currently in fixture list)
        return "friendly"
    except ValueError:
        return "friendly"


def parse_fixtures_from_page(soup: BeautifulSoup, team_label: str) -> list[dict]:
    """
    Parse all fixtures from a PlayCricket monthly fixtures page.

    Real structure (confirmed from debug HTML):
      div.title2          → date header text e.g. "Saturday 02 May 2026"
        [next sibling]
      div.card-table      → one match block per date
        p.time            → "12:30"
        p.location > a    → "Park Road"  (ground name)
        p.txt1 × 2        → home team, away team
        a[match_details]  → match ID in href

    Each div.title2 is followed by exactly one div.card-table sibling
    (one fixture per date header for a given team/month filter).
    """
    fixtures = []

    # ── Find all date header divs ──────────────────────────────────────────────
    # class check: "title2" must be one of the space-separated classes
    date_headers = soup.find_all(
        "div",
        class_=lambda c: c and "title2" in c.split()
    )

    if VERBOSE and not date_headers:
        print(f"   ℹ️  No div.title2 date headers found on page")

    for date_div in date_headers:
        # ── 1. Parse the date text ─────────────────────────────────────────────
        date_text = date_div.get_text(strip=True)
        date_iso  = parse_pc_date(date_text)

        if not date_iso:
            if VERBOSE:
                print(f"   ⚠️  Skipping date header — could not parse: '{date_text}'")
            continue

        # ── 2. Find the next sibling div.card-table ────────────────────────────
        card_div = date_div.find_next_sibling(
            "div",
            class_=lambda c: c and "card-table" in c.split()
        )
        if not card_div:
            if VERBOSE:
                print(f"   ⚠️  No card-table sibling found after date: {date_iso}")
            continue

        # ── 3. Extract match ID ────────────────────────────────────────────────
        match_link = card_div.find("a", href=re.compile(r"match_details\?id=\d+"))
        if not match_link:
            if VERBOSE:
                print(f"   ⚠️  No match_details link found for date: {date_iso}")
            continue

        match_id = extract_match_id_from_href(match_link.get("href", ""))
        if not match_id:
            continue

        # ── 4. Extract time ────────────────────────────────────────────────────
        # Prefer the desktop time (inside table > td.match-status > p.time)
        # Fall back to mobile time (div.match-status-mobile > p.time)
        time_tag  = card_div.find("p", class_="time")
        time_val  = parse_pc_time(time_tag.get_text(strip=True)) if time_tag else None

        # ── 5. Extract ground ──────────────────────────────────────────────────
        location_tag = card_div.find("p", class_="location")
        ground = None
        if location_tag:
            ground_link = location_tag.find("a")
            if ground_link:
                ground = ground_link.get_text(strip=True)

        # ── 6. Extract team names from p.txt1 ─────────────────────────────────
        # PlayCricket always renders: first p.txt1 = home team,
        #                             second p.txt1 = away team
        txt1_tags  = card_div.find_all("p", class_="txt1")
        home_team = normalise_raw_name(
            txt1_tags[0].get_text(separator=" ", strip=True)
        ) if len(txt1_tags) > 0 else ""
        away_team = normalise_raw_name(
            txt1_tags[1].get_text(separator=" ", strip=True)
        ) if len(txt1_tags) > 1 else ""

        # ── 7. Derive semantic fields ──────────────────────────────────────────
        home_or_away = determine_home_away(home_team, away_team)
        opponent = get_opponent(home_team, away_team, home_or_away, team_label)
        match_type = determine_match_type(date_iso, team_label)

        # Resolve team UUID — required foreign key in fixtures table
        team_uuid = TEAM_UUID_MAP.get(team_label)
        if not team_uuid:
            if VERBOSE:
                print(f"   ⚠️  No UUID found for team '{team_label}' — skipping")
            continue

        # day_type enum: 'saturday' for all Saturday XIs, 'sunday' for Sunday XI
        day_type = "sunday" if team_label == "Sunday XI" else "saturday"

        # Venue: all home fixtures played at HTCC's home ground.
        # Away venues set to TBC — admin updates via the app when confirmed.
        venue = "HTSC, Rayners Lane HA2 9TY" if home_or_away == "home" else "TBC"

        fixture = {
            "playcricket_id": match_id,
            "match_date": date_iso,
            "match_time": time_val or "13:00",
            "opponent": opponent,
            "home_away": home_or_away,
            "match_type": match_type,
            "day_type": day_type,
            "venue": venue,
            "team_id": team_uuid,
        }

        fixtures.append(fixture)

        if VERBOSE:
            print(
                f"   ✔  {date_iso} | {match_type:<10} | "
                f"vs {opponent:<30} | {home_or_away:<4} | "
                f"{time_val or 'TBC'} | {venue}"
            )

    return fixtures


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SCRAPE ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────

def scrape_all_fixtures() -> list[dict]:
    """
    Main entry point. Iterates all teams × all season months,
    fetches HTML, parses using confirmed PlayCricket structure,
    returns a deduplicated list of fixture dicts ready for Supabase upsert.
    """
    seen_ids: set[int] = set()
    all_fixtures: list[dict] = []
    total_pages = len(PC_TEAMS) * len(PC_SEASON_MONTHS)
    page_count = 0

    # Pre-parse season start date filter once (avoids repeated parsing in loop)
    season_start = SEASON_START_DATE

    for team_label, team_id in PC_TEAMS.items():
        print(f"\n📋  {team_label} (team_id={team_id})")

        for month in PC_SEASON_MONTHS:
            page_count += 1
            url = build_fixtures_url(team_id, month)

            if VERBOSE:
                month_name = datetime(2025, month, 1).strftime("%B")
                print(f"   [{page_count:02d}/{total_pages}] {month_name} → fetching...")

            html = fetch_page(url)
            if not html:
                print(f"   ⚠️  No response for {team_label} month {month}")
                continue

            if DEBUG_SAVE_HTML:
                save_debug_html(html, team_label, month)

            soup = BeautifulSoup(html, "lxml")

            # Parse using confirmed PlayCricket structure
            page_fixtures = parse_fixtures_from_page(soup, team_label)

            # Deduplicate and apply season start date filter
            new_count = 0
            for f in page_fixtures:
                mid = f["playcricket_id"]

                # Skip fixtures before the official season start date
                if season_start and f.get("match_date") and f["match_date"] < season_start:
                    if VERBOSE:
                        print(
                            f"   ⏭  Pre-season — skipped {f['match_date']} "
                            f"vs {f['opponent']} ({team_label})"
                        )
                    continue

                if mid not in seen_ids:
                    seen_ids.add(mid)
                    all_fixtures.append(f)
                    new_count += 1

            if not page_fixtures:
                print(f"   ─  No fixtures this month")
            elif VERBOSE:
                print(f"   ✅  {new_count} new fixture(s) added")

    print(f"\n{'─'*50}")
    print(f"  Total unique fixtures scraped: {len(all_fixtures)}")
    print(f"{'─'*50}")
    return all_fixtures