import logging
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session as DbSession

from ingestion.config import db_session
from ingestion.models import Circuit, Driver, Event, Result, Season, Series, Session, Team

logger = logging.getLogger(__name__)

SERIES_SLUG = "wec"
WEC_CALENDAR_URL = "https://api.fia.com/events/world-endurance-championship/season-{year}/races-calendar"

MONTHS = {
    "Jan": 1,
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9,
    "Oct": 10,
    "Nov": 11,
    "Dec": 12,
}


@dataclass(frozen=True)
class CircuitInfo:
    circuit_name: str
    country: str
    city: str
    timezone_name: str
    result_slug: str


WEC_CIRCUIT_MAP = {
    "qatar 1812km": CircuitInfo("Lusail International Circuit", "Qatar", "Lusail", "Asia/Qatar", "qatar-1812km"),
    "6 hours of imola": CircuitInfo("Autodromo Enzo e Dino Ferrari", "Italy", "Imola", "Europe/Rome", "6-hours-imola"),
    "totalenergies 6 hours of spa-francorchamps": CircuitInfo("Circuit de Spa-Francorchamps", "Belgium", "Stavelot", "Europe/Brussels", "totalenergies-6-hours-spa-francorchamps"),
    "24 hours of le mans": CircuitInfo("Circuit de la Sarthe", "France", "Le Mans", "Europe/Paris", "24-hours-le-mans"),
    "rolex 6 hours of sao paulo": CircuitInfo("Autodromo Jose Carlos Pace", "Brazil", "Sao Paulo", "America/Sao_Paulo", "rolex-6-hours-sao-paulo"),
    "lone star le mans": CircuitInfo("Circuit of the Americas", "United States", "Austin", "America/Chicago", "lone-star-le-mans"),
    "6 hours of fuji": CircuitInfo("Fuji Speedway", "Japan", "Oyama", "Asia/Tokyo", "6-hours-of-fuji"),
    "bapco energies 8 hours of bahrain": CircuitInfo("Bahrain International Circuit", "Bahrain", "Sakhir", "Asia/Bahrain", "8-hours-of-bahrain"),
}


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _normalize_class_name(raw: object) -> str:
    value = str(raw or "").strip()
    return value if value else "Overall"


def _normalize_wec_name(name: str) -> str:
    clean = re.sub(r"\s+", " ", name).strip()
    clean = re.sub(r"\s+TBA$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+LE\s+MANS\s+24\s+HEURES$", "", clean, flags=re.IGNORECASE)
    return clean.strip()


def _normalize_key(text: str) -> str:
    """Normalize event names for resilient map lookups."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_text).strip().lower()


def _parse_wec_calendar_text(year: int, text: str) -> list[dict]:
    # The FIA endpoint returns full HTML; parse visible text first.
    visible_text = BeautifulSoup(text, "html.parser").get_text("\n", strip=True)
    lines = [ln.strip() for ln in visible_text.splitlines() if ln.strip()]

    try:
        start_idx = lines.index("Sport competitions") + 1
    except ValueError:
        return []

    events: list[dict] = []
    i = start_idx

    while i + 4 < len(lines):
        day1 = lines[i]
        mon1 = lines[i + 1]
        day2 = lines[i + 2]
        mon2 = lines[i + 3]

        if not (day1.isdigit() and day2.isdigit() and mon1 in MONTHS and mon2 in MONTHS):
            i += 1
            continue

        name = _normalize_wec_name(lines[i + 4])
        if not name:
            i += 5
            continue

        try:
            start_date = datetime(year, MONTHS[mon1], int(day1), tzinfo=timezone.utc).date()
            end_date = datetime(year, MONTHS[mon2], int(day2), tzinfo=timezone.utc).date()
        except ValueError:
            i += 5
            continue

        events.append(
            {
                "name": name,
                "start_date": start_date,
                "end_date": end_date,
                "slug": _slugify(f"{year}-{name}"),
            }
        )
        i += 5

    return events


def _get_series(db: DbSession) -> Optional[Series]:
    series = db.query(Series).filter(Series.slug == SERIES_SLUG).first()
    if not series:
        logger.error("WEC series not found in database. Ensure seed data exists.")
    return series


def _find_or_create(db: DbSession, model, filters: dict, defaults: dict):
    instance = db.query(model).filter_by(**filters).first()
    if not instance:
        instance = model(**filters, **defaults)
        db.add(instance)
        db.flush()
    return instance


def _find_or_create_season(db: DbSession, series_id: int, year: int) -> Season:
    return _find_or_create(db, Season, {"series_id": series_id, "year": year}, {})


def _find_or_create_circuit(db: DbSession, info: CircuitInfo) -> Circuit:
    return _find_or_create(
        db,
        Circuit,
        {"name": info.circuit_name},
        {
            "country": info.country,
            "city": info.city,
            "timezone": info.timezone_name,
            "track_map_url": None,
        },
    )


def _find_or_create_team(db: DbSession, series_id: int, team_name: str) -> Team:
    short_name = team_name[:50]
    return _find_or_create(
        db,
        Team,
        {"series_id": series_id, "name": team_name},
        {"short_name": short_name, "color": "#4D4D4D"},
    )


def _find_or_create_driver(db: DbSession, display_name: str, number: int, team_id: int) -> Driver:
    slug = _slugify(f"wec-{display_name}-{number}")
    driver = db.query(Driver).filter(Driver.slug == slug).first()
    if not driver:
        driver = Driver(name=display_name, slug=slug, number=number, team_id=team_id)
        db.add(driver)
        db.flush()
    elif driver.team_id != team_id:
        driver.team_id = team_id
    return driver


def _extract_wec_race_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue

        # FIA pages use first table row as headers inside <td>, not <th>.
        first_row_cells = rows[0].find_all(["td", "th"])
        headers = [c.get_text(" ", strip=True).lower() for c in first_row_cells]
        if not headers:
            continue
        if "pos" not in headers or "team" not in headers or "drivers" not in headers:
            continue

        index_map = {name: idx for idx, name in enumerate(headers)}

        def idx_for(keyword: str) -> Optional[int]:
            for key, idx in index_map.items():
                if keyword in key:
                    return idx
            return None

        pos_idx = idx_for("pos")
        team_idx = idx_for("team")
        drivers_idx = idx_for("drivers")
        laps_idx = idx_for("laps")
        total_time_idx = idx_for("total")
        gap_idx = idx_for("gap first") or idx_for("gap")
        status_idx = idx_for("status")
        class_idx = idx_for("class") or idx_for("category") or idx_for("cat")

        if pos_idx is None or team_idx is None or drivers_idx is None:
            continue

        parsed_rows: list[dict] = []
        for tr in rows[1:]:
            cells = tr.find_all("td")
            if not cells:
                continue
            vals = [td.get_text(" ", strip=True) for td in cells]
            if pos_idx >= len(vals):
                continue
            pos_raw = vals[pos_idx]
            if not pos_raw.isdigit():
                continue

            team_text = vals[team_idx] if team_idx < len(vals) else ""
            m = re.match(r"^(\d+)\s+(.*)$", team_text)
            if m:
                car_number = int(m.group(1))
                team_name = m.group(2).strip()
            else:
                car_number = int(pos_raw)
                team_name = team_text or "Unknown Team"

            drivers_text = vals[drivers_idx] if drivers_idx < len(vals) else ""
            primary_driver = drivers_text.split("/")[0].strip() if drivers_text else f"Car {car_number}"

            parsed_rows.append(
                {
                    "position": int(pos_raw),
                    "car_number": car_number,
                    "team_name": team_name,
                    "driver_name": primary_driver,
                    "class_name": _normalize_class_name(vals[class_idx] if class_idx is not None and class_idx < len(vals) else None),
                    "laps": int(vals[laps_idx]) if laps_idx is not None and laps_idx < len(vals) and vals[laps_idx].isdigit() else None,
                    "time": vals[total_time_idx] if total_time_idx is not None and total_time_idx < len(vals) else None,
                    "gap": vals[gap_idx] if gap_idx is not None and gap_idx < len(vals) else None,
                    "status": vals[status_idx] if status_idx is not None and status_idx < len(vals) else "Classified",
                }
            )

        if parsed_rows:
            return parsed_rows

    return []


class WecIngestion:
    def _fetch_calendar_html(self, year: int) -> Optional[str]:
        url = WEC_CALENDAR_URL.format(year=year)
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception:
            logger.exception("Failed to fetch WEC %d calendar", year)
            return None

    def _fetch_result_link_map(self, year: int) -> dict[str, str]:
        """Build a map of race slug -> classification URL from FIA calendar page links."""
        try:
            calendar_html = requests.get(WEC_CALENDAR_URL.format(year=year), timeout=30).text
            soup = BeautifulSoup(calendar_html, "html.parser")
            link_map: dict[str, str] = {}
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if f"/season-{year}/" not in href:
                    continue
                if "/race-classification" not in href and "/race" not in href:
                    continue
                full = href if href.startswith("http") else f"https://www.fia.com{href}"
                m = re.search(rf"/season-{year}/([^/]+)/", full)
                if not m:
                    continue
                slug = m.group(1)
                # Prefer explicit race-classification URL when both links exist.
                if slug not in link_map or "race-classification" in full:
                    link_map[slug] = full
            return link_map
        except Exception:
            logger.exception("Failed to build WEC result link map for %d", year)
            return {}

    def _fetch_race_classification_html(self, year: int, race_slug: str, link_map: dict[str, str]) -> Optional[str]:
        url = link_map.get(
            race_slug,
            f"https://www.fia.com/events/world-endurance-championship/season-{year}/{race_slug}/race-classification",
        )
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception:
            logger.exception("Failed to fetch WEC race classification: %d %s", year, race_slug)
            return None

    def sync_calendar(self, year: int) -> None:
        logger.info("Syncing WEC %d calendar...", year)
        html = self._fetch_calendar_html(year)
        if not html:
            return

        events = _parse_wec_calendar_text(year, html)
        if not events:
            logger.warning("No WEC events parsed for year %d", year)
            return

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return

            season = _find_or_create_season(db, series.id, year)

            for item in events:
                circuit_info = WEC_CIRCUIT_MAP.get(_normalize_key(item["name"]))
                if not circuit_info:
                    logger.warning("No circuit mapping for WEC event '%s'", item["name"])
                    continue

                circuit = _find_or_create_circuit(db, circuit_info)
                event = db.query(Event).filter(Event.slug == item["slug"]).first()
                if not event:
                    event = Event(
                        season_id=season.id,
                        circuit_id=circuit.id,
                        name=item["name"],
                        slug=item["slug"],
                        start_date=item["start_date"],
                        end_date=item["end_date"],
                        status="upcoming",
                    )
                    db.add(event)
                    db.flush()
                else:
                    event.season_id = season.id
                    event.circuit_id = circuit.id
                    event.start_date = item["start_date"]
                    event.end_date = item["end_date"]

                existing_race = db.query(Session).filter(
                    Session.event_id == event.id,
                    Session.type == "race",
                ).first()
                if not existing_race:
                    db.add(
                        Session(
                            event_id=event.id,
                            type="race",
                            name="Race",
                            start_time=datetime(
                                item["start_date"].year,
                                item["start_date"].month,
                                item["start_date"].day,
                                12,
                                0,
                                tzinfo=timezone.utc,
                            ),
                            status="scheduled",
                        )
                    )

        logger.info("WEC %d calendar sync complete (%d events).", year, len(events))

    def sync_results_for_year(self, year: int) -> None:
        logger.info("Syncing WEC %d race results...", year)
        link_map = self._fetch_result_link_map(year)

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return

            season = (
                db.query(Season)
                .filter(Season.series_id == series.id, Season.year == year)
                .first()
            )
            if not season:
                logger.warning("WEC season %d not found, skipping results sync", year)
                return

            events = db.query(Event).filter(Event.season_id == season.id).all()
            for event in events:
                race_session = (
                    db.query(Session)
                    .filter(Session.event_id == event.id, Session.type == "race")
                    .first()
                )
                if not race_session:
                    continue

                existing_count = db.query(Result).filter(Result.session_id == race_session.id).count()
                if existing_count > 0:
                    continue

                info = WEC_CIRCUIT_MAP.get(_normalize_key(event.name))
                if not info:
                    logger.warning("No WEC result mapping for event '%s'", event.name)
                    continue

                html = self._fetch_race_classification_html(year, info.result_slug, link_map)
                if not html:
                    continue

                rows = _extract_wec_race_rows(html)
                if not rows:
                    logger.warning("No WEC result rows parsed for %s", event.slug)
                    continue

                for row in rows:
                    team = _find_or_create_team(db, series.id, row["team_name"])
                    driver = _find_or_create_driver(db, row["driver_name"], row["car_number"], team.id)
                    db.add(
                        Result(
                            session_id=race_session.id,
                            driver_id=driver.id,
                            position=row["position"],
                            laps=row["laps"],
                            time=row["time"],
                            gap=row["gap"],
                            status=row["status"] or "Classified",
                            class_name=row["class_name"],
                        )
                    )

                race_session.status = "completed"
                if event.end_date and event.end_date <= datetime.now(timezone.utc).date():
                    event.status = "completed"
                logger.info("Synced WEC results for %s (%d rows)", event.slug, len(rows))

    def sync_results(self, event_slug: str) -> None:
        logger.info("WEC results sync not yet implemented (event_slug=%s)", event_slug)
