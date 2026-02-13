import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import unquote, urljoin

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session as DbSession

from ingestion.config import db_session
from ingestion.models import Circuit, Driver, Event, Result, Season, Series, Session, Team

logger = logging.getLogger(__name__)

SERIES_SLUG = "imsa"
IMSA_RESULTS_BASE_URL = "https://imsa.results.alkamelcloud.com"


@dataclass(frozen=True)
class CircuitInfo:
    country: str
    city: str
    timezone_name: str


IMSA_CIRCUIT_MAP = {
    "Daytona International Speedway": CircuitInfo("United States", "Daytona Beach", "America/New_York"),
    "Sebring International Raceway": CircuitInfo("United States", "Sebring", "America/New_York"),
    "Long Beach Street Circuit": CircuitInfo("United States", "Long Beach", "America/Los_Angeles"),
    "Weathertech Raceway Laguna Seca": CircuitInfo("United States", "Monterey", "America/Los_Angeles"),
    "WeatherTech Raceway Laguna Seca": CircuitInfo("United States", "Monterey", "America/Los_Angeles"),
    "Detroit Street Course": CircuitInfo("United States", "Detroit", "America/New_York"),
    "Detroit Street Circuit": CircuitInfo("United States", "Detroit", "America/New_York"),
    "Watkins Glen International": CircuitInfo("United States", "Watkins Glen", "America/New_York"),
    "Canadian Tire Motorsport Park": CircuitInfo("Canada", "Bowmanville", "America/Toronto"),
    "Road America": CircuitInfo("United States", "Elkhart Lake", "America/Chicago"),
    "VIRginia International Raceway": CircuitInfo("United States", "Alton", "America/New_York"),
    "Indianapolis Motor Speedway RC": CircuitInfo("United States", "Indianapolis", "America/Indiana/Indianapolis"),
    "Indianapolis Motor Speedway": CircuitInfo("United States", "Indianapolis", "America/Indiana/Indianapolis"),
    "Road Atlanta": CircuitInfo("United States", "Braselton", "America/New_York"),
    "Michelin Raceway Road Atlanta": CircuitInfo("United States", "Braselton", "America/New_York"),
}


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _parse_event_name_from_dir(track_dir: str) -> str:
    decoded = unquote(track_dir).strip("/")
    return re.sub(r"^\d+_", "", decoded).strip()


def _fetch_directory_links(url: str) -> list[str]:
    try:
        html = requests.get(url, timeout=30).text
    except Exception:
        logger.exception("Failed to fetch IMSA directory listing: %s", url)
        return []

    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("?"):
            continue
        if href.startswith("/Results/"):
            continue
        links.append(href)
    return links


def _extract_imsa_result_rows_from_json(payload: dict) -> list[dict]:
    rows = payload.get("classification")
    if not isinstance(rows, list):
        return []

    parsed: list[dict] = []
    for row in rows:
        pos = row.get("position")
        if not isinstance(pos, int):
            continue
        number_raw = str(row.get("number", "")).strip()
        if not number_raw.isdigit():
            continue

        drivers = row.get("drivers") or []
        display_name = f"Car {number_raw}"
        if drivers and isinstance(drivers, list):
            d = drivers[0]
            first = str(d.get("firstname", "")).strip()
            last = str(d.get("surname", "")).strip()
            full = f"{first} {last}".strip()
            if full:
                display_name = full

        laps_raw = str(row.get("laps", "")).strip()
        laps = int(laps_raw) if laps_raw.isdigit() else None

        parsed.append(
            {
                "position": pos,
                "car_number": int(number_raw),
                "driver_name": display_name,
                "team_name": str(row.get("team", "Unknown Team")).strip() or "Unknown Team",
                "laps": laps,
                "time": str(row.get("elapsed_time", "")).strip() or None,
                "gap": str(row.get("gap_first", "")).strip() or None,
                "status": str(row.get("status", "finished")).strip() or "finished",
            }
        )

    return parsed


def _get_series(db: DbSession) -> Optional[Series]:
    series = db.query(Series).filter(Series.slug == SERIES_SLUG).first()
    if not series:
        logger.error("IMSA series not found in database. Ensure seed data exists.")
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


def _find_or_create_circuit(db: DbSession, circuit_name: str) -> Circuit:
    info = IMSA_CIRCUIT_MAP.get(circuit_name, CircuitInfo("United States", "", "UTC"))
    return _find_or_create(
        db,
        Circuit,
        {"name": circuit_name},
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
    slug = _slugify(f"imsa-{display_name}-{number}")
    driver = db.query(Driver).filter(Driver.slug == slug).first()
    if not driver:
        driver = Driver(name=display_name, slug=slug, number=number, team_id=team_id)
        db.add(driver)
        db.flush()
    elif driver.team_id != team_id:
        driver.team_id = team_id
    return driver


class ImsaIngestion:
    def _year_dir_url(self, year: int) -> str:
        yy = str(year)[-2:]
        return f"{IMSA_RESULTS_BASE_URL}/Results/{yy}_{year}/"

    def _discover_weathertech_events(self, year: int) -> list[dict]:
        year_url = self._year_dir_url(year)
        track_dirs = [h for h in _fetch_directory_links(year_url) if h.endswith("/") and re.match(r"^\d+_.+/$", h)]
        events: list[dict] = []

        for track_dir in sorted(track_dirs):
            event_name = _parse_event_name_from_dir(track_dir)
            track_url = urljoin(year_url, track_dir)
            series_dirs = _fetch_directory_links(track_url)
            weathertech_dir = next(
                (
                    d
                    for d in series_dirs
                    if d.endswith("/") and "IMSA%20WeatherTech%20SportsCar%20Championship" in d
                ),
                None,
            )
            if not weathertech_dir:
                continue

            series_url = urljoin(track_url, weathertech_dir)
            race_dirs = [d for d in _fetch_directory_links(series_url) if d.endswith("/") and "_Race/" in d]
            if not race_dirs:
                continue

            race_dir = sorted(race_dirs)[0]
            date_match = re.match(r"^(\d{8})", race_dir)
            if date_match:
                start_date = datetime.strptime(date_match.group(1), "%Y%m%d").date()
            else:
                start_date = datetime(year, 1, 1, tzinfo=timezone.utc).date()

            events.append(
                {
                    "name": event_name,
                    "slug": _slugify(f"{year}-{event_name}"),
                    "start_date": start_date,
                    "end_date": start_date,
                    "circuit_name": event_name,
                    "series_url": series_url,
                    "race_dir": race_dir,
                }
            )

        return events

    def _find_official_race_json(self, series_url: str, race_dir: str) -> Optional[str]:
        race_url = urljoin(series_url, race_dir)
        top_links = _fetch_directory_links(race_url)

        # Some events expose files directly in the race folder.
        for href in top_links:
            if href.endswith("03_Results_Race_Official.JSON"):
                return urljoin(race_url, href)

        # Endurance events typically store official classification in the final hour folder.
        subdirs = [h for h in top_links if h.endswith("/")]

        def sort_key(h: str) -> int:
            m = re.match(r"^(\d+)_", unquote(h))
            return int(m.group(1)) if m else 0

        for sub in sorted(subdirs, key=sort_key, reverse=True):
            sub_url = urljoin(race_url, sub)
            for href in _fetch_directory_links(sub_url):
                if href.endswith("03_Results_Race_Official.JSON"):
                    return urljoin(sub_url, href)

        return None

    def sync_calendar(self, year: int) -> None:
        logger.info("Syncing IMSA %d calendar from official results index...", year)
        events = self._discover_weathertech_events(year)
        if not events:
            logger.warning("No IMSA WeatherTech events discovered for year %d", year)
            return

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return
            season = _find_or_create_season(db, series.id, year)

            for item in events:
                circuit = _find_or_create_circuit(db, item["circuit_name"])
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

                race_session = db.query(Session).filter(Session.event_id == event.id, Session.type == "race").first()
                if not race_session:
                    db.add(
                        Session(
                            event_id=event.id,
                            type="race",
                            name="Race",
                            start_time=datetime(
                                item["start_date"].year,
                                item["start_date"].month,
                                item["start_date"].day,
                                17,
                                0,
                                tzinfo=timezone.utc,
                            ),
                            status="scheduled",
                        )
                    )

        logger.info("IMSA %d calendar sync complete (%d events).", year, len(events))

    def sync_results_for_year(self, year: int) -> None:
        logger.info("Syncing IMSA %d race results from official results index...", year)
        discovered = self._discover_weathertech_events(year)
        event_to_json: dict[str, str] = {}
        for item in discovered:
            json_url = self._find_official_race_json(item["series_url"], item["race_dir"])
            if json_url:
                event_to_json[item["slug"]] = json_url

        if not event_to_json:
            logger.warning("No IMSA official race JSON files discovered for %d", year)
            return

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return
            season = db.query(Season).filter(Season.series_id == series.id, Season.year == year).first()
            if not season:
                logger.warning("IMSA season %d not found; run calendar sync first", year)
                return

            events = db.query(Event).filter(Event.season_id == season.id).all()
            for event in events:
                race_session = db.query(Session).filter(Session.event_id == event.id, Session.type == "race").first()
                if not race_session:
                    continue
                if db.query(Result).filter(Result.session_id == race_session.id).count() > 0:
                    continue

                json_url = event_to_json.get(event.slug)
                if not json_url:
                    continue

                try:
                    raw = requests.get(json_url, timeout=30).content
                    payload = json.loads(raw.decode("utf-8-sig"))
                except Exception:
                    logger.exception("Failed to fetch/parse IMSA race JSON for %s", event.slug)
                    continue

                rows = _extract_imsa_result_rows_from_json(payload)
                if not rows:
                    logger.warning("No IMSA rows parsed for %s", event.slug)
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
                            status=row["status"],
                        )
                    )

                race_session.status = "completed"
                if event.end_date and event.end_date <= datetime.now(timezone.utc).date():
                    event.status = "completed"
                logger.info("Synced IMSA results for %s (%d rows)", event.slug, len(rows))
