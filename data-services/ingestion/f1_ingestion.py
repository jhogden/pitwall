import logging
import time
from datetime import datetime, timezone
from typing import Optional

import fastf1
import pandas as pd
import requests
from sqlalchemy.orm import Session as DbSession
from sqlalchemy import text

from ingestion.config import db_session
from ingestion.models import Series, Season, Circuit, Event, Session, Team, Driver, Result

logger = logging.getLogger(__name__)

SERIES_SLUG = "f1"

# Maps FastF1 session names (from schedule) to our DB session types
SESSION_TYPE_MAP = {
    "Practice 1": "practice",
    "Practice 2": "practice",
    "Practice 3": "practice",
    "Sprint Shootout": "qualifying",
    "Sprint Qualifying": "qualifying",
    "Sprint": "sprint",
    "Qualifying": "qualifying",
    "Race": "race",
}

# FastF1 session codes for result syncing
FASTF1_SESSION_CODES = {
    "R": "race",
    "Q": "qualifying",
    "S": "sprint",
    "SQ": "qualifying",
}

SESSION_COLUMNS = [
    ("Session1", "Session1Date"),
    ("Session2", "Session2Date"),
    ("Session3", "Session3Date"),
    ("Session4", "Session4Date"),
    ("Session5", "Session5Date"),
]


def slugify(text: str) -> str:
    return text.lower().replace(" ", "-").replace(".", "").replace("'", "")


def _get_series(db: DbSession) -> Optional[Series]:
    series = db.query(Series).filter(Series.slug == SERIES_SLUG).first()
    if not series:
        logger.error("F1 series not found in database. Ensure seed data exists.")
    return series


def _find_or_create(db: DbSession, model, filters: dict, defaults: dict):
    """Generic find-or-create helper."""
    instance = db.query(model).filter_by(**filters).first()
    if not instance:
        instance = model(**filters, **defaults)
        db.add(instance)
        db.flush()
    return instance


def _find_or_create_circuit(db: DbSession, name: str, country: str) -> Circuit:
    circuit = _find_or_create(db, Circuit, {"name": name}, {"country": country, "city": "", "timezone": "UTC"})
    return circuit


def _find_or_create_season(db: DbSession, series_id: int, year: int) -> Season:
    return _find_or_create(db, Season, {"series_id": series_id, "year": year}, {})


def _find_or_create_team(db: DbSession, series_id: int, team_name: str) -> Team:
    short_name = team_name[:50]
    return _find_or_create(
        db, Team,
        {"series_id": series_id, "name": team_name},
        {"short_name": short_name, "color": "#888888"},
    )


def _find_or_create_driver(
    db: DbSession, first_name: str, last_name: str,
    number: Optional[int], team_id: Optional[int]
) -> Driver:
    full_name = f"{first_name} {last_name}"
    slug = slugify(full_name)
    driver = db.query(Driver).filter(Driver.slug == slug).first()
    if not driver:
        driver = Driver(name=full_name, slug=slug, number=number, team_id=team_id)
        db.add(driver)
        db.flush()
    elif team_id and driver.team_id != team_id:
        driver.team_id = team_id
    return driver


def _derive_positions_from_laps(f1_session, results_df: pd.DataFrame) -> pd.DataFrame:
    """When Position is all NaN (post-Ergast shutdown), derive from lap data."""
    if not results_df["Position"].isna().all():
        return results_df

    laps = f1_session.laps
    if laps is None or laps.empty:
        return results_df

    final_positions = (
        laps.groupby("DriverNumber")[["LapNumber", "Position"]]
        .last()
        .sort_values("Position")
    )
    pos_map = {
        str(driver_num): rank
        for rank, (driver_num, _) in enumerate(final_positions.iterrows(), start=1)
    }
    results_df = results_df.copy()
    results_df["Position"] = results_df["DriverNumber"].astype(str).map(pos_map)
    logger.info("Derived positions from lap data for %d drivers", len(pos_map))
    return results_df


def _fetch_jolpica_results(year: int, round_number: int) -> Optional[list]:
    """Fetch official race results from the Jolpica API (Ergast successor)."""
    url = f"https://api.jolpi.ca/ergast/f1/{year}/{round_number}/results.json"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        races = data["MRData"]["RaceTable"]["Races"]
        if not races:
            return None
        return races[0]["Results"]
    except Exception:
        logger.exception("Failed to fetch Jolpica results for %d Round %d", year, round_number)
        return None


def _fetch_jolpica_qualifying(year: int, round_number: int) -> Optional[list]:
    """Fetch qualifying results from the Jolpica API (Q1/Q2/Q3 times)."""
    url = f"https://api.jolpi.ca/ergast/f1/{year}/{round_number}/qualifying.json"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        races = data["MRData"]["RaceTable"]["Races"]
        if not races:
            return None
        return races[0].get("QualifyingResults")
    except Exception:
        logger.exception("Failed to fetch Jolpica qualifying for %d Round %d", year, round_number)
        return None


def _fetch_jolpica_sprint(year: int, round_number: int) -> Optional[list]:
    """Fetch sprint results from the Jolpica API (finish times, laps, status)."""
    url = f"https://api.jolpi.ca/ergast/f1/{year}/{round_number}/sprint.json"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        races = data["MRData"]["RaceTable"]["Races"]
        if not races:
            return None
        return races[0].get("SprintResults")
    except Exception:
        logger.exception("Failed to fetch Jolpica sprint for %d Round %d", year, round_number)
        return None


def _fetch_jolpica_schedule(year: int) -> Optional[list]:
    """Fetch the full season schedule from the Jolpica API."""
    url = f"https://api.jolpi.ca/ergast/f1/{year}.json"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        races = data["MRData"]["RaceTable"]["Races"]
        return races if races else None
    except Exception:
        logger.exception("Failed to fetch Jolpica schedule for %d", year)
        return None


def _to_int(value) -> Optional[int]:
    if value is None or (isinstance(value, float) and pd.isna(value)) or pd.isna(value):
        return None
    try:
        return int(value)
    except Exception:
        return None


def _to_bool(value) -> Optional[bool]:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text_value = str(value).strip().lower()
    if text_value in {"true", "1", "yes"}:
        return True
    if text_value in {"false", "0", "no"}:
        return False
    return None


def _extract_tire_stints_from_laps(laps_df: pd.DataFrame) -> list[dict]:
    if laps_df is None or laps_df.empty:
        return []

    required_cols = {"DriverNumber", "LapNumber", "Stint"}
    if not required_cols.issubset(set(laps_df.columns)):
        return []

    rows: list[dict] = []
    base = laps_df.copy()
    base = base[base["DriverNumber"].notna() & base["LapNumber"].notna() & base["Stint"].notna()]
    if base.empty:
        return []

    for driver_number, driver_laps in base.groupby("DriverNumber"):
        driver_sorted = driver_laps.sort_values("LapNumber")
        for stint_no, stint_rows in driver_sorted.groupby("Stint"):
            stint_sorted = stint_rows.sort_values("LapNumber")
            lap_start = _to_int(stint_sorted["LapNumber"].min())
            lap_end = _to_int(stint_sorted["LapNumber"].max())
            stint_number = _to_int(stint_no)
            if stint_number is None or lap_start is None or lap_end is None:
                continue

            compound = None
            if "Compound" in stint_sorted.columns:
                compounds = [str(value).strip() for value in stint_sorted["Compound"] if pd.notna(value)]
                if compounds:
                    compound = compounds[0]

            tyre_age_at_start = None
            if "TyreLife" in stint_sorted.columns:
                tyre_age_at_start = _to_int(stint_sorted["TyreLife"].dropna().iloc[0]) if not stint_sorted["TyreLife"].dropna().empty else None

            is_new_tyre = None
            if "FreshTyre" in stint_sorted.columns:
                non_null = stint_sorted["FreshTyre"].dropna()
                is_new_tyre = _to_bool(non_null.iloc[0]) if not non_null.empty else None

            rows.append(
                {
                    "driver_number": str(driver_number).strip(),
                    "stint_number": stint_number,
                    "compound": compound,
                    "lap_start": lap_start,
                    "lap_end": lap_end,
                    "tyre_age_at_start": tyre_age_at_start,
                    "is_new_tyre": is_new_tyre,
                }
            )

    return rows


def _format_timedelta(value) -> Optional[str]:
    if value is None or pd.isna(value):
        return None
    td = pd.to_timedelta(value)
    if pd.isna(td):
        return None
    total_seconds = td.total_seconds()
    if total_seconds < 0:
        return None
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = total_seconds - (hours * 3600 + minutes * 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:06.3f}"
    return f"{minutes}:{seconds:06.3f}"


def _format_float(value) -> Optional[str]:
    if value is None or pd.isna(value):
        return None
    try:
        return f"{float(value):.3f}".rstrip("0").rstrip(".")
    except Exception:
        return None


def _format_seconds(seconds) -> Optional[str]:
    if seconds is None:
        return None
    try:
        value = float(seconds)
    except Exception:
        return None
    if value < 0:
        return None
    minutes = int(value // 60)
    rem = value - minutes * 60
    return f"{minutes}:{rem:06.3f}"


def _extract_f1_lap_telemetry_from_laps(laps_df: pd.DataFrame) -> list[dict]:
    if laps_df is None or laps_df.empty:
        return []

    required_cols = {"DriverNumber", "LapNumber"}
    if not required_cols.issubset(set(laps_df.columns)):
        return []

    rows: list[dict] = []
    speeds = ["SpeedST", "SpeedFL", "SpeedI2", "SpeedI1"]

    base = laps_df.copy()
    base = base[base["DriverNumber"].notna() & base["LapNumber"].notna()]
    if base.empty:
        return []

    for _, row in base.iterrows():
        car_number = str(row.get("DriverNumber", "")).strip()
        if not car_number:
            continue
        lap_number = _to_int(row.get("LapNumber"))
        if lap_number is None:
            continue

        numeric_speeds = []
        for speed_col in speeds:
            if speed_col in row and pd.notna(row[speed_col]):
                try:
                    numeric_speeds.append(float(row[speed_col]))
                except Exception:
                    continue

        average_speed = _format_float(sum(numeric_speeds) / len(numeric_speeds)) if numeric_speeds else None
        top_speed = _format_float(max(numeric_speeds)) if numeric_speeds else None

        rows.append(
            {
                "car_number": car_number,
                "lap_number": lap_number,
                "position": _to_int(row.get("Position")),
                "lap_time": _format_timedelta(row.get("LapTime")),
                "sector1_time": _format_timedelta(row.get("Sector1Time")),
                "sector2_time": _format_timedelta(row.get("Sector2Time")),
                "sector3_time": _format_timedelta(row.get("Sector3Time")),
                "sector4_time": _format_timedelta(row.get("Sector4Time")),
                "average_speed_kph": average_speed,
                "top_speed_kph": top_speed,
                "session_elapsed": _format_timedelta(row.get("Time")),
                "lap_timestamp": row.get("LapStartDate"),
                "is_valid": _to_bool(row.get("IsAccurate")),
                "crossing_pit_finish_lane": _to_bool(row.get("PitOutTime")),
            }
        )

    return rows


class F1Ingestion:

    def sync_calendar(self, year: int) -> None:
        logger.info("Syncing F1 %d calendar...", year)
        with db_session() as db:
            series = _get_series(db)
            if not series:
                return

            season = _find_or_create_season(db, series.id, year)
            schedule = fastf1.get_event_schedule(year)

            for _, event_row in schedule.iterrows():
                self._sync_event(db, season, event_row, year)

        logger.info("F1 %d calendar sync complete.", year)

    def _sync_event(self, db: DbSession, season: Season, event_row, year: int) -> None:
        event_name = str(event_row.get("EventName", ""))
        if not event_name or event_name == "nan":
            return

        round_number = int(event_row.get("RoundNumber", 0))
        if round_number == 0:
            return

        country = str(event_row.get("Country", ""))
        location = str(event_row.get("Location", ""))
        circuit = _find_or_create_circuit(db, location, country)
        event_slug = slugify(f"{year}-{event_name}")

        event_date = event_row.get("EventDate")
        start_date = event_date.date() if hasattr(event_date, "date") else None

        event = db.query(Event).filter(Event.slug == event_slug).first()
        if not event:
            event = Event(
                circuit_id=circuit.id,
                season_id=season.id,
                name=event_name,
                slug=event_slug,
                start_date=start_date,
                end_date=start_date,
                status="upcoming",
            )
            db.add(event)
            db.flush()
            logger.info("Created event: %s (Round %d)", event_name, round_number)
        else:
            event.circuit_id = circuit.id
            event.start_date = start_date
            event.end_date = start_date

        for session_col, date_col in SESSION_COLUMNS:
            self._sync_session(db, event, event_row, session_col, date_col)

        db.flush()

    def _sync_session(self, db: DbSession, event: Event, event_row, session_col: str, date_col: str) -> None:
        session_name = str(event_row.get(session_col, ""))
        if not session_name or session_name == "nan":
            return

        session_type = SESSION_TYPE_MAP.get(session_name, "practice")
        session_date = event_row.get(date_col)
        start_time = session_date if hasattr(session_date, "hour") else datetime.now(timezone.utc)

        existing = db.query(Session).filter(
            Session.event_id == event.id, Session.name == session_name
        ).first()

        if not existing:
            db.add(Session(
                event_id=event.id,
                type=session_type,
                name=session_name,
                start_time=start_time,
                status="scheduled",
            ))

    def resolve_round_number(self, year: int, event_slug: str) -> Optional[int]:
        """Look up the FastF1 round number for a given event slug."""
        schedule = fastf1.get_event_schedule(year)
        for _, row in schedule.iterrows():
            event_name = str(row.get("EventName", ""))
            if not event_name or event_name == "nan":
                continue
            if slugify(f"{year}-{event_name}") == event_slug:
                return int(row.get("RoundNumber", 0)) or None
        return None

    def sync_all_session_results_by_slug(self, year: int, event_slug: str) -> None:
        """Sync results for all session types, looking up round number from slug."""
        round_number = self.resolve_round_number(year, event_slug)
        if not round_number:
            logger.warning("Could not resolve round number for %s", event_slug)
            return
        self.sync_all_session_results(year, round_number)

    def sync_all_session_results(self, year: int, round_number: int) -> None:
        """Sync results for all available session types."""
        for code, session_type in FASTF1_SESSION_CODES.items():
            try:
                self._sync_session_results(year, round_number, code, session_type)
            except Exception:
                logger.debug("No %s data for F1 %d Round %d", code, year, round_number)

    def _sync_session_results(
        self, year: int, round_number: int, session_code: str, session_type: str
    ) -> None:
        logger.info("Syncing F1 %d Round %d %s results...", year, round_number, session_code)

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return

            schedule = fastf1.get_event_schedule(year)
            round_row = schedule[schedule["RoundNumber"] == round_number]
            if round_row.empty:
                return

            event_name = str(round_row.iloc[0]["EventName"])
            event_slug = slugify(f"{year}-{event_name}")

            target_event = db.query(Event).filter(Event.slug == event_slug).first()
            if not target_event:
                return

            db_session_obj = db.query(Session).filter(
                Session.event_id == target_event.id,
                Session.type == session_type,
            ).first()
            if not db_session_obj:
                return

            existing_count = db.query(Result).filter(Result.session_id == db_session_obj.id).count()

            if session_code == "R":
                # Use Jolpica API for race results (correct official classifications)
                if existing_count == 0:
                    jolpica_results = _fetch_jolpica_results(year, round_number)
                    if not jolpica_results:
                        logger.warning("No Jolpica results for F1 %d Round %d", year, round_number)
                        return
                    self._create_results_from_jolpica(db, series, jolpica_results, db_session_obj)
                else:
                    logger.debug("Skipping race result insert for %d R%d (already present)", year, round_number)

                if year >= 2018:
                    try:
                        f1_session = fastf1.get_session(year, round_number, "R")
                        f1_session.load()
                        self._upsert_tire_stints_from_fastf1(db, series, f1_session, db_session_obj)
                    except Exception:
                        logger.warning(
                            "Could not sync tire stints for F1 %d Round %d",
                            year,
                            round_number,
                            exc_info=True,
                        )
            elif session_code in ("Q", "SQ"):
                if existing_count == 0:
                    jolpica = _fetch_jolpica_qualifying(year, round_number)
                    if jolpica:
                        self._create_results_from_jolpica_qualifying(db, series, jolpica, db_session_obj)
                    else:
                        # FastF1 fallback (positions only)
                        f1_session = fastf1.get_session(year, round_number, session_code)
                        f1_session.load()
                        results_df = f1_session.results
                        if results_df is None or results_df.empty:
                            return
                        results_df = _derive_positions_from_laps(f1_session, results_df)
                        self._create_results(db, series, results_df, db_session_obj)

            elif session_code == "S":
                if existing_count == 0:
                    jolpica = _fetch_jolpica_sprint(year, round_number)
                    if jolpica:
                        self._create_results_from_jolpica_sprint(db, series, jolpica, db_session_obj)
                    else:
                        # FastF1 fallback (positions only)
                        f1_session = fastf1.get_session(year, round_number, session_code)
                        f1_session.load()
                        results_df = f1_session.results
                        if results_df is None or results_df.empty:
                            return
                        results_df = _derive_positions_from_laps(f1_session, results_df)
                        self._create_results(db, series, results_df, db_session_obj)

            db_session_obj.status = "completed"

            if session_code == "R":
                target_event.status = "completed"

        logger.info("F1 %d Round %d %s sync complete.", year, round_number, session_code)

    def _upsert_tire_stints_from_fastf1(self, db: DbSession, series: Series, f1_session, session: Session) -> None:
        self._ensure_tire_stints_table(db)
        laps_df = f1_session.laps
        rows = _extract_tire_stints_from_laps(laps_df)
        if not rows:
            return

        driver_rows = (
            db.execute(
                text(
                    """
                    SELECT DISTINCT d.id, d.number
                    FROM results r
                    JOIN drivers d ON d.id = r.driver_id
                    WHERE r.session_id = :session_id
                    """
                ),
                {"session_id": session.id},
            )
            .mappings()
            .all()
        )
        number_to_driver_id = {str(row["number"]): row["id"] for row in driver_rows if row["number"] is not None}

        # For sessions without persisted results yet, build/update driver mapping
        # from FastF1's own session results so stint upsert is not blocked.
        f1_results = getattr(f1_session, "results", None)
        if f1_results is not None and not f1_results.empty:
            for _, result_row in f1_results.iterrows():
                raw_number = result_row.get("DriverNumber")
                if pd.isna(raw_number):
                    continue
                driver_number = int(raw_number)
                key = str(driver_number)
                if key in number_to_driver_id:
                    continue

                first_name = str(result_row.get("FirstName", "")).strip()
                last_name = str(result_row.get("LastName", "")).strip()
                if not first_name and not last_name:
                    fallback = str(result_row.get("Abbreviation", ""))
                    first_name = fallback

                team_name = str(result_row.get("TeamName", "Unknown")).strip() or "Unknown"
                team = _find_or_create_team(db, series.id, team_name)
                driver = _find_or_create_driver(db, first_name, last_name, driver_number, team.id)
                number_to_driver_id[key] = driver.id

        upserted = 0
        for row in rows:
            driver_id = number_to_driver_id.get(row["driver_number"])
            if not driver_id:
                continue
            db.execute(
                text(
                    """
                    INSERT INTO tire_stints (
                        session_id, driver_id, stint_number, compound,
                        lap_start, lap_end, tyre_age_at_start, is_new_tyre, source
                    )
                    VALUES (
                        :session_id, :driver_id, :stint_number, :compound,
                        :lap_start, :lap_end, :tyre_age_at_start, :is_new_tyre, 'fastf1'
                    )
                    ON CONFLICT (session_id, driver_id, stint_number) DO UPDATE SET
                        compound = EXCLUDED.compound,
                        lap_start = EXCLUDED.lap_start,
                        lap_end = EXCLUDED.lap_end,
                        tyre_age_at_start = EXCLUDED.tyre_age_at_start,
                        is_new_tyre = EXCLUDED.is_new_tyre,
                        source = EXCLUDED.source
                    """
                ),
                {
                    "session_id": session.id,
                    "driver_id": driver_id,
                    "stint_number": row["stint_number"],
                    "compound": row["compound"],
                    "lap_start": row["lap_start"],
                    "lap_end": row["lap_end"],
                    "tyre_age_at_start": row["tyre_age_at_start"],
                    "is_new_tyre": row["is_new_tyre"],
                },
            )
            upserted += 1

        if upserted:
            logger.info("Upserted %d tire stints for session %s", upserted, session.id)

    def _ensure_tire_stints_table(self, db: DbSession) -> None:
        db.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS tire_stints (
                    id BIGSERIAL PRIMARY KEY,
                    session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    driver_id BIGINT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
                    stint_number INTEGER NOT NULL,
                    compound VARCHAR(50),
                    lap_start INTEGER NOT NULL,
                    lap_end INTEGER NOT NULL,
                    tyre_age_at_start INTEGER,
                    is_new_tyre BOOLEAN,
                    source VARCHAR(30),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_tire_stints_session_driver_stint UNIQUE (session_id, driver_id, stint_number)
                )
                """
            )
        )

    def _create_results(
        self, db: DbSession, series: Series, results_df: pd.DataFrame, session: Session
    ) -> None:
        for _, row in results_df.iterrows():
            first_name = str(row.get("FirstName", ""))
            last_name = str(row.get("LastName", ""))
            team_name = str(row.get("TeamName", ""))
            raw_number = row.get("DriverNumber")
            driver_number = int(raw_number) if pd.notna(raw_number) else None
            raw_position = row.get("Position")
            position = int(raw_position) if pd.notna(raw_position) else None
            status = str(row.get("Status", "finished"))
            if position is None:
                position = 0

            team = _find_or_create_team(db, series.id, team_name)
            driver = _find_or_create_driver(db, first_name, last_name, driver_number, team.id)

            db.add(Result(
                session_id=session.id,
                driver_id=driver.id,
                position=position,
                status=status,
                class_name="Overall",
            ))

    def _create_results_from_jolpica(
        self, db: DbSession, series: Series, jolpica_results: list, session: Session
    ) -> None:
        for entry in jolpica_results:
            driver_data = entry["Driver"]
            first_name = driver_data.get("givenName", "")
            last_name = driver_data.get("familyName", "")
            raw_number = driver_data.get("permanentNumber")
            driver_number = int(raw_number) if raw_number else None

            constructor = entry.get("Constructor", {})
            team_name = constructor.get("name", "Unknown")

            position = int(entry.get("position", 0))
            laps = int(entry.get("laps", 0)) or None
            status = entry.get("status", "Finished")

            # Gap: winner has absolute time, others have relative gap
            time_info = entry.get("Time", {})
            gap = time_info.get("time") if time_info else None

            team = _find_or_create_team(db, series.id, team_name)
            driver = _find_or_create_driver(db, first_name, last_name, driver_number, team.id)

            db.add(Result(
                session_id=session.id,
                driver_id=driver.id,
                position=position,
                gap=gap,
                laps=laps,
                status=status,
                class_name="Overall",
            ))

    def _create_results_from_jolpica_qualifying(
        self, db: DbSession, series: Series, jolpica_results: list, session: Session
    ) -> None:
        for entry in jolpica_results:
            driver_data = entry["Driver"]
            first_name = driver_data.get("givenName", "")
            last_name = driver_data.get("familyName", "")
            raw_number = driver_data.get("permanentNumber")
            driver_number = int(raw_number) if raw_number else None

            constructor = entry.get("Constructor", {})
            team_name = constructor.get("name", "Unknown")

            position = int(entry.get("position", 0))

            # Pick best qualifying time: Q3 > Q2 > Q1
            gap = entry.get("Q3") or entry.get("Q2") or entry.get("Q1") or None

            team = _find_or_create_team(db, series.id, team_name)
            driver = _find_or_create_driver(db, first_name, last_name, driver_number, team.id)

            db.add(Result(
                session_id=session.id,
                driver_id=driver.id,
                position=position,
                gap=gap,
                laps=None,
                status="Finished",
                class_name="Overall",
            ))

    def _create_results_from_jolpica_sprint(
        self, db: DbSession, series: Series, jolpica_results: list, session: Session
    ) -> None:
        for entry in jolpica_results:
            driver_data = entry["Driver"]
            first_name = driver_data.get("givenName", "")
            last_name = driver_data.get("familyName", "")
            raw_number = driver_data.get("permanentNumber")
            driver_number = int(raw_number) if raw_number else None

            constructor = entry.get("Constructor", {})
            team_name = constructor.get("name", "Unknown")

            position = int(entry.get("position", 0))
            laps = int(entry.get("laps", 0)) or None
            status = entry.get("status", "Finished")

            time_info = entry.get("Time", {})
            gap = time_info.get("time") if time_info else None

            team = _find_or_create_team(db, series.id, team_name)
            driver = _find_or_create_driver(db, first_name, last_name, driver_number, team.id)

            db.add(Result(
                session_id=session.id,
                driver_id=driver.id,
                position=position,
                gap=gap,
                laps=laps,
                status=status,
                class_name="Overall",
            ))

    def sync_calendar_from_jolpica(self, year: int) -> None:
        """Sync calendar for a season using the Jolpica API (works for all years 1950+)."""
        logger.info("Syncing F1 %d calendar from Jolpica...", year)
        races = _fetch_jolpica_schedule(year)
        if not races:
            logger.warning("No Jolpica schedule data for %d", year)
            return

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return

            season = _find_or_create_season(db, series.id, year)

            for race in races:
                round_number = int(race["round"])
                race_name = race["raceName"]
                circuit_info = race["Circuit"]
                circuit_name = circuit_info["circuitName"]
                country = circuit_info["Location"]["country"]

                circuit = _find_or_create_circuit(db, circuit_name, country)
                event_slug = slugify(f"{year}-{race_name}")

                race_date_str = race.get("date")
                race_date = datetime.strptime(race_date_str, "%Y-%m-%d").date() if race_date_str else None

                event = db.query(Event).filter(Event.slug == event_slug).first()
                if not event:
                    event = Event(
                        circuit_id=circuit.id,
                        season_id=season.id,
                        name=race_name,
                        slug=event_slug,
                        start_date=race_date,
                        end_date=race_date,
                        status="completed",
                    )
                    db.add(event)
                    db.flush()
                    logger.info("Created event: %s (Round %d)", race_name, round_number)

                # Create a Race session if one doesn't exist
                existing_session = db.query(Session).filter(
                    Session.event_id == event.id, Session.name == "Race"
                ).first()
                if not existing_session:
                    race_time_str = race.get("time")
                    if race_date and race_time_str:
                        start_time = datetime.strptime(
                            f"{race_date_str} {race_time_str}", "%Y-%m-%d %H:%M:%SZ"
                        ).replace(tzinfo=timezone.utc)
                    elif race_date:
                        start_time = datetime(race_date.year, race_date.month, race_date.day, 14, 0, tzinfo=timezone.utc)
                    else:
                        start_time = datetime(year, 1, 1, 14, 0, tzinfo=timezone.utc)

                    db.add(Session(
                        event_id=event.id,
                        type="race",
                        name="Race",
                        start_time=start_time,
                        status="completed",
                    ))

        logger.info("F1 %d Jolpica calendar sync complete.", year)

    def sync_race_results(self, year: int, round_number: int, race_name: str) -> None:
        """Sync race results for a single round using Jolpica. Requires the race name to find the event."""
        event_slug = slugify(f"{year}-{race_name}")

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return

            event = db.query(Event).filter(Event.slug == event_slug).first()
            if not event:
                logger.warning("Event not found for slug: %s", event_slug)
                return

            race_session = db.query(Session).filter(
                Session.event_id == event.id, Session.type == "race"
            ).first()
            if not race_session:
                logger.warning("No race session for event: %s", event_slug)
                return

            existing_count = db.query(Result).filter(Result.session_id == race_session.id).count()
            if existing_count > 0:
                return

            jolpica_results = _fetch_jolpica_results(year, round_number)
            if not jolpica_results:
                logger.warning("No Jolpica results for %d Round %d", year, round_number)
                return

            self._create_results_from_jolpica(db, series, jolpica_results, race_session)
            race_session.status = "completed"
            event.status = "completed"

        logger.info("F1 %d Round %d results sync complete.", year, round_number)

    def sync_historical_season(self, year: int) -> None:
        """Sync calendar and all race results for a historical season."""
        logger.info("Syncing historical season: %d", year)

        self.sync_calendar_from_jolpica(year)

        races = _fetch_jolpica_schedule(year)
        if not races:
            return

        for race in races:
            round_number = int(race["round"])
            race_name = race["raceName"]
            try:
                self.sync_race_results(year, round_number, race_name)
            except Exception:
                logger.exception("Failed to sync results for %d Round %d", year, round_number)
            time.sleep(2)

    def sync_tire_stints_for_year(self, year: int) -> None:
        """Backfill F1 race tire stints from FastF1 for a season (2018+)."""
        if year < 2018:
            logger.info("Skipping F1 %d tire stints (FastF1 race lap data starts in 2018).", year)
            return

        logger.info("Syncing F1 %d tire stints...", year)
        schedule = fastf1.get_event_schedule(year)
        rounds = (
            schedule["RoundNumber"]
            .dropna()
            .astype(int)
            .tolist()
        )
        for round_number in rounds:
            try:
                self._sync_session_results(year, round_number, "R", "race")
            except Exception:
                logger.warning("Failed tire stint sync for F1 %d Round %d", year, round_number, exc_info=True)
            time.sleep(1)

    def sync_lap_telemetry_for_year(self, year: int) -> None:
        """Backfill F1 race lap telemetry from OpenF1 for a season (2018+)."""
        if year < 2018:
            logger.info("Skipping F1 %d lap telemetry (OpenF1 race lap data starts in 2018).", year)
            return

        logger.info("Syncing F1 %d lap telemetry...", year)
        try:
            openf1_sessions = requests.get(
                "https://api.openf1.org/v1/sessions",
                params={"year": year, "session_name": "Race"},
                timeout=30,
            ).json()
        except Exception:
            logger.warning("Could not fetch OpenF1 race sessions for %d", year, exc_info=True)
            return

        with db_session() as db:
            series = _get_series(db)
            if not series:
                return
            season = db.query(Season).filter(Season.series_id == series.id, Season.year == year).first()
            if not season:
                logger.warning("F1 season %d not found; run calendar sync first", year)
                return

            race_sessions = (
                db.query(Session, Event)
                .join(Event, Event.id == Session.event_id)
                .filter(Event.season_id == season.id, Session.type == "race")
                .all()
            )
            if not race_sessions:
                logger.warning("No F1 race sessions found for %d", year)
                return

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

            for race_session, event in race_sessions:
                try:
                    if not openf1_sessions:
                        continue
                    race_start = race_session.start_time
                    best_openf1 = None
                    best_delta = None
                    for candidate in openf1_sessions:
                        date_start = candidate.get("date_start")
                        if not date_start:
                            continue
                        try:
                            candidate_dt = datetime.fromisoformat(str(date_start).replace("Z", "+00:00"))
                        except Exception:
                            continue
                        delta = abs((candidate_dt - race_start).total_seconds())
                        if best_delta is None or delta < best_delta:
                            best_delta = delta
                            best_openf1 = candidate

                    if not best_openf1 or best_delta is None or best_delta > 60 * 60 * 72:
                        logger.warning("No OpenF1 race session match for %s", event.slug)
                        continue

                    session_key = best_openf1.get("session_key")
                    if not session_key:
                        continue

                    driver_payload = requests.get(
                        "https://api.openf1.org/v1/drivers",
                        params={"session_key": session_key},
                        timeout=30,
                    ).json()
                    laps_payload = requests.get(
                        "https://api.openf1.org/v1/laps",
                        params={"session_key": session_key},
                        timeout=30,
                    ).json()
                    if not laps_payload:
                        continue

                    number_to_driver_id: dict[str, int] = {}
                    for driver_row in driver_payload:
                        raw_number = driver_row.get("driver_number")
                        if raw_number is None:
                            continue
                        driver_number = int(raw_number)
                        first_name = str(driver_row.get("first_name", "")).strip()
                        last_name = str(driver_row.get("last_name", "")).strip()
                        full_name = str(driver_row.get("full_name", "")).strip()
                        if full_name and (not first_name and not last_name):
                            parts = full_name.split(" ", 1)
                            first_name = parts[0]
                            last_name = parts[1] if len(parts) > 1 else ""
                        if not first_name and not last_name:
                            first_name = str(driver_row.get("name_acronym", "")).strip()

                        team_name = str(driver_row.get("team_name", "Unknown")).strip() or "Unknown"
                        team = _find_or_create_team(db, series.id, team_name)
                        team_color = str(driver_row.get("team_colour", "")).strip()
                        if team_color:
                            if not team_color.startswith("#"):
                                team_color = f"#{team_color}"
                            team.color = team_color

                        driver = _find_or_create_driver(db, first_name, last_name, driver_number, team.id)
                        number_to_driver_id[str(driver_number)] = driver.id

                    upserted = 0
                    for lap in laps_payload:
                        raw_driver_number = lap.get("driver_number")
                        raw_lap_number = lap.get("lap_number")
                        if raw_driver_number is None or raw_lap_number is None:
                            continue
                        car_number = str(int(raw_driver_number))
                        lap_number = int(raw_lap_number)

                        i1_speed = lap.get("i1_speed")
                        i2_speed = lap.get("i2_speed")
                        st_speed = lap.get("st_speed")
                        numeric_speeds = [float(v) for v in (i1_speed, i2_speed, st_speed) if v is not None]
                        average_speed = _format_float(sum(numeric_speeds) / len(numeric_speeds)) if numeric_speeds else None
                        top_speed = _format_float(max(numeric_speeds)) if numeric_speeds else None

                        sector1 = _format_seconds(lap.get("duration_sector_1"))
                        sector2 = _format_seconds(lap.get("duration_sector_2"))
                        sector3 = _format_seconds(lap.get("duration_sector_3"))
                        lap_time = _format_seconds(lap.get("lap_duration"))

                        lap_timestamp = None
                        raw_date_start = lap.get("date_start")
                        if raw_date_start:
                            try:
                                lap_timestamp = datetime.fromisoformat(str(raw_date_start).replace("Z", "+00:00"))
                            except Exception:
                                lap_timestamp = None

                        db.execute(
                            upsert_sql,
                            {
                                "session_id": race_session.id,
                                "driver_id": number_to_driver_id.get(car_number),
                                "car_number": car_number,
                                "lap_number": lap_number,
                                "position": None,
                                "lap_time": lap_time,
                                "sector1_time": sector1,
                                "sector2_time": sector2,
                                "sector3_time": sector3,
                                "sector4_time": None,
                                "average_speed_kph": average_speed,
                                "top_speed_kph": top_speed,
                                "session_elapsed": None,
                                "lap_timestamp": lap_timestamp,
                                "is_valid": lap_time is not None,
                                "crossing_pit_finish_lane": _to_bool(lap.get("is_pit_out_lap")),
                            },
                        )
                        upserted += 1

                    logger.info("Synced F1 lap telemetry for %s (%d laps)", event.slug, upserted)
                except Exception:
                    logger.warning("Failed F1 lap telemetry sync for %s", event.slug, exc_info=True)
                time.sleep(0.5)
