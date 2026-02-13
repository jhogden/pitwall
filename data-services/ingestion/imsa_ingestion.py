import json
import logging
import re
import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import unquote, urljoin

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session as DbSession
from sqlalchemy import text

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


def _extract_imsa_result_rows_from_csv(content: str) -> list[dict]:
    rows: list[dict] = []
    reader = csv.DictReader(content.splitlines(), delimiter=";")

    for row in reader:
        pos_raw = str(row.get("POSITION", "")).strip()
        if not pos_raw.isdigit():
            continue

        number_raw = str(row.get("NUMBER", "")).strip()
        car_number_match = re.search(r"\d+", number_raw)
        if not car_number_match:
            continue
        car_number = int(car_number_match.group(0))

        laps_raw = str(row.get("LAPS", "")).strip()
        laps = int(laps_raw) if laps_raw.isdigit() else None

        first = str(row.get("DRIVER1_FIRSTNAME", "")).strip()
        last = str(row.get("DRIVER1_SECONDNAME", "")).strip()
        if first or last:
            driver_name = f"{first} {last}".strip()
        else:
            driver_name = str(row.get("DRIVER_1", "")).strip() or str(row.get("DRIVER", "")).strip() or f"Car {number_raw}"

        rows.append(
            {
                "position": int(pos_raw),
                "car_number": car_number,
                "driver_name": driver_name,
                "team_name": str(row.get("TEAM", "Unknown Team")).strip() or "Unknown Team",
                "laps": laps,
                "time": str(row.get("TOTAL_TIME", "")).strip() or None,
                "gap": str(row.get("GAP_FIRST", "")).strip() or None,
                "status": str(row.get("STATUS", "finished")).strip() or "finished",
            }
        )

    return rows


def _parse_hour_timestamp(raw: str) -> Optional[datetime]:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        # Example: 1/25/2025 1:42:36 PM
        dt = datetime.strptime(raw, "%m/%d/%Y %I:%M:%S %p")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _extract_imsa_lap_telemetry_from_json(timecards_payload: dict, lapchart_payload: dict) -> list[dict]:
    participants = timecards_payload.get("participants")
    lap_rows = lapchart_payload.get("laps")
    if not isinstance(participants, list) or not isinstance(lap_rows, list):
        return []

    position_map: dict[tuple[str, int], int] = {}
    for lap in lap_rows:
        lap_number = lap.get("lap_number")
        positions = lap.get("positions")
        if not isinstance(lap_number, int) or not isinstance(positions, list):
            continue
        for item in positions:
            car_number = str(item.get("number", "")).strip()
            pos = item.get("position")
            if car_number and isinstance(pos, int):
                position_map[(car_number, lap_number)] = pos

    parsed: list[dict] = []
    for p in participants:
        car_number = str(p.get("number", "")).strip()
        if not car_number:
            continue

        team_name = str(p.get("team", "Unknown Team")).strip() or "Unknown Team"
        driver_lookup: dict[str, str] = {}
        for d in p.get("drivers", []) or []:
            driver_number = str(d.get("number", "")).strip()
            full_name = f"{str(d.get('firstname', '')).strip()} {str(d.get('surname', '')).strip()}".strip()
            if driver_number and full_name:
                driver_lookup[driver_number] = full_name

        laps = p.get("laps")
        if not isinstance(laps, list):
            continue

        for lap in laps:
            lap_number = lap.get("number")
            if not isinstance(lap_number, int):
                continue

            lap_driver_number = str(lap.get("driver_number", "")).strip()
            driver_name = driver_lookup.get(lap_driver_number) or next(iter(driver_lookup.values()), f"Car {car_number}")

            sectors = {1: None, 2: None, 3: None, 4: None}
            for s in lap.get("sector_times", []) or []:
                idx = s.get("index")
                if isinstance(idx, int) and idx in sectors:
                    sectors[idx] = str(s.get("time", "")).strip() or None

            parsed.append(
                {
                    "car_number": car_number,
                    "team_name": team_name,
                    "driver_name": driver_name,
                    "lap_number": lap_number,
                    "position": position_map.get((car_number, lap_number)),
                    "lap_time": str(lap.get("time", "")).strip() or None,
                    "sector1_time": sectors[1],
                    "sector2_time": sectors[2],
                    "sector3_time": sectors[3],
                    "sector4_time": sectors[4],
                    "average_speed_kph": str(lap.get("average_speed_kph", "")).strip() or None,
                    "top_speed_kph": str(lap.get("top_speed_kph", "")).strip() or None,
                    "session_elapsed": str(lap.get("session_elapsed", "")).strip() or None,
                    "lap_timestamp": _parse_hour_timestamp(str(lap.get("hour", ""))),
                    "is_valid": bool(lap.get("is_valid", False)),
                    "crossing_pit_finish_lane": bool(lap.get("crossing_pit_finish_lane", False)),
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


def _find_or_create_driver(db: DbSession, display_name: str, number: Optional[int], team_id: int) -> Driver:
    number_part = str(number) if number is not None else "na"
    slug = _slugify(f"imsa-{display_name}-{number_part}")
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

    def _find_race_artifacts(self, series_url: str, race_dir: str) -> dict[str, str]:
        race_url = urljoin(series_url, race_dir)
        top_links = _fetch_directory_links(race_url)

        artifacts: dict[str, str] = {}
        result_candidates: list[tuple[int, str]] = []

        def candidate_rank(decoded: str) -> int:
            lowered = decoded.lower()
            if "official" in lowered:
                rank = 0
            elif "provisional" in lowered:
                rank = 1
            elif "unofficial" in lowered:
                rank = 2
            else:
                rank = 3

            # Hourly snapshots are valid but lower priority than explicit race result files.
            if "by hour" in lowered:
                rank += 10
            if "by class" in lowered:
                rank += 20
            return rank

        def pick_artifact(base_url: str, links: list[str]) -> None:
            for href in links:
                decoded = unquote(href)
                lowered = decoded.lower()
                full = urljoin(base_url, href)
                is_results_file = (
                    lowered.endswith(".json") or lowered.endswith(".csv")
                ) and "results" in lowered

                if is_results_file and any(
                    token in lowered
                    for token in ["grid", "fastest lap", "analysis", "weather", "leadersequence"]
                ):
                    is_results_file = False

                if is_results_file:
                    result_candidates.append((candidate_rank(decoded), full))

                if decoded.endswith("23_Time Cards_Race.JSON"):
                    artifacts.setdefault("timecards", full)
                elif decoded.endswith("12_Lap Chart_Race.JSON"):
                    artifacts.setdefault("lapchart", full)

        # Some events expose files directly in the race folder.
        pick_artifact(race_url, top_links)

        # Endurance events typically store official files in the final hour folder.
        subdirs = [h for h in top_links if h.endswith("/")]

        def sort_key(h: str) -> int:
            m = re.match(r"^(\d+)_", unquote(h))
            return int(m.group(1)) if m else 0

        for sub in sorted(subdirs, key=sort_key, reverse=True):
            sub_url = urljoin(race_url, sub)
            pick_artifact(sub_url, _fetch_directory_links(sub_url))

        if result_candidates:
            artifacts["results"] = sorted(result_candidates, key=lambda r: r[0])[0][1]

        return artifacts

    def _ensure_lap_telemetry_table(self, db: DbSession) -> None:
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS lap_telemetry (
                    id BIGSERIAL PRIMARY KEY,
                    session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
                    car_number VARCHAR(16) NOT NULL,
                    lap_number INT NOT NULL,
                    position INT,
                    lap_time VARCHAR(20),
                    sector1_time VARCHAR(20),
                    sector2_time VARCHAR(20),
                    sector3_time VARCHAR(20),
                    sector4_time VARCHAR(20),
                    average_speed_kph VARCHAR(20),
                    top_speed_kph VARCHAR(20),
                    session_elapsed VARCHAR(20),
                    lap_timestamp TIMESTAMPTZ,
                    is_valid BOOLEAN,
                    crossing_pit_finish_lane BOOLEAN,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (session_id, car_number, lap_number)
                );
                """
            )
        )
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_lap_telemetry_session_id ON lap_telemetry(session_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_lap_telemetry_driver_id ON lap_telemetry(driver_id);"))

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
            json_url = self._find_race_artifacts(item["series_url"], item["race_dir"]).get("results")
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
                except Exception:
                    logger.exception("Failed to fetch/parse IMSA race JSON for %s", event.slug)
                    continue

                decoded = raw.decode("utf-8-sig")
                if json_url.lower().endswith(".json"):
                    try:
                        payload = json.loads(decoded)
                    except Exception:
                        logger.exception("Failed to decode IMSA race JSON for %s", event.slug)
                        continue
                    rows = _extract_imsa_result_rows_from_json(payload)
                elif json_url.lower().endswith(".csv"):
                    rows = _extract_imsa_result_rows_from_csv(decoded)
                else:
                    logger.warning("Unsupported IMSA results artifact for %s: %s", event.slug, json_url)
                    continue

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

    def sync_lap_telemetry_for_year(self, year: int) -> None:
        logger.info("Syncing IMSA %d lap telemetry (time cards + lap chart)...", year)
        discovered = self._discover_weathertech_events(year)
        event_to_artifacts: dict[str, dict[str, str]] = {}
        for item in discovered:
            artifacts = self._find_race_artifacts(item["series_url"], item["race_dir"])
            if artifacts.get("timecards") and artifacts.get("lapchart"):
                event_to_artifacts[item["slug"]] = artifacts

        if not event_to_artifacts:
            logger.warning("No IMSA telemetry artifacts discovered for %d", year)
            return

        with db_session() as db:
            self._ensure_lap_telemetry_table(db)
            series = _get_series(db)
            if not series:
                return
            season = db.query(Season).filter(Season.series_id == series.id, Season.year == year).first()
            if not season:
                logger.warning("IMSA season %d not found; run calendar sync first", year)
                return

            events = db.query(Event).filter(Event.season_id == season.id).all()
            for event in events:
                artifacts = event_to_artifacts.get(event.slug)
                if not artifacts:
                    continue

                race_session = db.query(Session).filter(Session.event_id == event.id, Session.type == "race").first()
                if not race_session:
                    continue

                try:
                    timecards = json.loads(requests.get(artifacts["timecards"], timeout=30).content.decode("utf-8-sig"))
                    lapchart = json.loads(requests.get(artifacts["lapchart"], timeout=30).content.decode("utf-8-sig"))
                except Exception:
                    logger.exception("Failed to fetch IMSA telemetry artifacts for %s", event.slug)
                    continue

                lap_rows = _extract_imsa_lap_telemetry_from_json(timecards, lapchart)
                if not lap_rows:
                    logger.warning("No IMSA lap telemetry rows parsed for %s", event.slug)
                    continue

                upsert_sql = text(
                    """
                    INSERT INTO lap_telemetry (
                        session_id, driver_id, car_number, lap_number, position, lap_time,
                        sector1_time, sector2_time, sector3_time, sector4_time,
                        average_speed_kph, top_speed_kph, session_elapsed, lap_timestamp,
                        is_valid, crossing_pit_finish_lane
                    )
                    VALUES (
                        :session_id, :driver_id, :car_number, :lap_number, :position, :lap_time,
                        :sector1_time, :sector2_time, :sector3_time, :sector4_time,
                        :average_speed_kph, :top_speed_kph, :session_elapsed, :lap_timestamp,
                        :is_valid, :crossing_pit_finish_lane
                    )
                    ON CONFLICT (session_id, car_number, lap_number) DO UPDATE SET
                        driver_id = EXCLUDED.driver_id,
                        position = EXCLUDED.position,
                        lap_time = EXCLUDED.lap_time,
                        sector1_time = EXCLUDED.sector1_time,
                        sector2_time = EXCLUDED.sector2_time,
                        sector3_time = EXCLUDED.sector3_time,
                        sector4_time = EXCLUDED.sector4_time,
                        average_speed_kph = EXCLUDED.average_speed_kph,
                        top_speed_kph = EXCLUDED.top_speed_kph,
                        session_elapsed = EXCLUDED.session_elapsed,
                        lap_timestamp = EXCLUDED.lap_timestamp,
                        is_valid = EXCLUDED.is_valid,
                        crossing_pit_finish_lane = EXCLUDED.crossing_pit_finish_lane
                    """
                )

                upserted = 0
                for row in lap_rows:
                    team = _find_or_create_team(db, series.id, row["team_name"])
                    car_number_int = int(row["car_number"]) if row["car_number"].isdigit() else None
                    driver = _find_or_create_driver(db, row["driver_name"], car_number_int, team.id)
                    db.execute(
                        upsert_sql,
                        {
                            "session_id": race_session.id,
                            "driver_id": driver.id,
                            "car_number": row["car_number"],
                            "lap_number": row["lap_number"],
                            "position": row["position"],
                            "lap_time": row["lap_time"],
                            "sector1_time": row["sector1_time"],
                            "sector2_time": row["sector2_time"],
                            "sector3_time": row["sector3_time"],
                            "sector4_time": row["sector4_time"],
                            "average_speed_kph": row["average_speed_kph"],
                            "top_speed_kph": row["top_speed_kph"],
                            "session_elapsed": row["session_elapsed"],
                            "lap_timestamp": row["lap_timestamp"],
                            "is_valid": row["is_valid"],
                            "crossing_pit_finish_lane": row["crossing_pit_finish_lane"],
                        },
                    )
                    upserted += 1

                logger.info("Synced IMSA lap telemetry for %s (%d laps)", event.slug, upserted)
