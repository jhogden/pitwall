import logging
from datetime import datetime, timezone
from typing import Optional

import fastf1
import pandas as pd
import requests
from sqlalchemy.orm import Session as DbSession

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
            if existing_count > 0:
                return

            if session_code == "R":
                # Use Jolpica API for race results (correct official classifications)
                jolpica_results = _fetch_jolpica_results(year, round_number)
                if not jolpica_results:
                    logger.warning("No Jolpica results for F1 %d Round %d", year, round_number)
                    return
                self._create_results_from_jolpica(db, series, jolpica_results, db_session_obj)
            else:
                # Use FastF1 for non-race sessions (qualifying, sprint)
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
            ))
