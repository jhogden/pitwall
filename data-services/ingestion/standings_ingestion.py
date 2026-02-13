import logging
from collections import defaultdict
from decimal import Decimal
from typing import Iterable, Optional

import requests
from sqlalchemy.orm import Session as DbSession

from ingestion.config import db_session
from ingestion.f1_ingestion import _find_or_create_driver, _find_or_create_team
from ingestion.models import ConstructorStanding, DriverStanding, Result, Season, Series, Session

logger = logging.getLogger(__name__)

F1_SERIES_SLUG = "f1"

# Simple fallback table for derived standings when official points are unavailable.
DEFAULT_POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]


def _points_for_position(position: int, points_table: Iterable[int]) -> int:
    if position <= 0:
        return 0
    index = position - 1
    table = list(points_table)
    if index >= len(table):
        return 0
    return table[index]


def _fetch_jolpica_driver_standings(year: int) -> Optional[list]:
    url = f"https://api.jolpi.ca/ergast/f1/{year}/driverstandings.json"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        payload = response.json()
        lists = payload["MRData"]["StandingsTable"]["StandingsLists"]
        if not lists:
            return None
        return lists[0].get("DriverStandings") or None
    except Exception:
        logger.exception("Failed to fetch Jolpica driver standings for %d", year)
        return None


def _fetch_jolpica_constructor_standings(year: int) -> Optional[list]:
    url = f"https://api.jolpi.ca/ergast/f1/{year}/constructorstandings.json"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        payload = response.json()
        lists = payload["MRData"]["StandingsTable"]["StandingsLists"]
        if not lists:
            return None
        return lists[0].get("ConstructorStandings") or None
    except Exception:
        logger.exception("Failed to fetch Jolpica constructor standings for %d", year)
        return None


def _get_series_and_season(db: DbSession, series_slug: str, year: int) -> tuple[Optional[Series], Optional[Season]]:
    series = db.query(Series).filter(Series.slug == series_slug).first()
    if not series:
        logger.warning("Series not found for standings: %s", series_slug)
        return None, None

    season = db.query(Season).filter(Season.series_id == series.id, Season.year == year).first()
    if not season:
        logger.warning("Season not found for standings: %s %d", series_slug, year)
        return series, None

    return series, season


def _upsert_driver_standing(
    db: DbSession, season_id: int, driver_id: int, class_name: str, position: int, points: float, wins: int
) -> None:
    standing = (
        db.query(DriverStanding)
        .filter(
            DriverStanding.season_id == season_id,
            DriverStanding.driver_id == driver_id,
            DriverStanding.class_name == class_name,
        )
        .first()
    )
    if not standing:
        standing = DriverStanding(
            season_id=season_id,
            driver_id=driver_id,
            class_name=class_name,
            position=position,
            points=Decimal(str(points)),
            wins=wins,
        )
        db.add(standing)
        return

    standing.position = position
    standing.points = Decimal(str(points))
    standing.wins = wins


def _upsert_constructor_standing(
    db: DbSession, season_id: int, team_id: int, class_name: str, position: int, points: float, wins: int
) -> None:
    standing = (
        db.query(ConstructorStanding)
        .filter(
            ConstructorStanding.season_id == season_id,
            ConstructorStanding.team_id == team_id,
            ConstructorStanding.class_name == class_name,
        )
        .first()
    )
    if not standing:
        standing = ConstructorStanding(
            season_id=season_id,
            team_id=team_id,
            class_name=class_name,
            position=position,
            points=Decimal(str(points)),
            wins=wins,
        )
        db.add(standing)
        return

    standing.position = position
    standing.points = Decimal(str(points))
    standing.wins = wins


class StandingsIngestion:
    def sync_f1_official_standings(self, year: int) -> bool:
        """Sync official F1 driver and constructor standings from Jolpica API."""
        driver_rows = _fetch_jolpica_driver_standings(year)
        constructor_rows = _fetch_jolpica_constructor_standings(year)
        if not driver_rows and not constructor_rows:
            return False

        with db_session() as db:
            series, season = _get_series_and_season(db, F1_SERIES_SLUG, year)
            if not series or not season:
                return False

            if driver_rows or constructor_rows:
                db.query(DriverStanding).filter(DriverStanding.season_id == season.id).delete(synchronize_session=False)
                db.query(ConstructorStanding).filter(ConstructorStanding.season_id == season.id).delete(synchronize_session=False)

            if driver_rows:
                for row in driver_rows:
                    driver_data = row.get("Driver", {})
                    first_name = str(driver_data.get("givenName", "")).strip()
                    last_name = str(driver_data.get("familyName", "")).strip()
                    team_data = (row.get("Constructors") or [{}])[0]
                    team_name = str(team_data.get("name", "Unknown Team")).strip() or "Unknown Team"

                    permanent_number = driver_data.get("permanentNumber")
                    driver_number = int(permanent_number) if str(permanent_number).isdigit() else None

                    team = _find_or_create_team(db, series.id, team_name)
                    driver = _find_or_create_driver(db, first_name, last_name, driver_number, team.id)

                    position = int(str(row.get("position", "0")).strip() or 0)
                    points = float(str(row.get("points", "0")).strip() or 0)
                    wins = int(str(row.get("wins", "0")).strip() or 0)
                    if position <= 0:
                        continue

                    _upsert_driver_standing(db, season.id, driver.id, "Overall", position, points, wins)

            if constructor_rows:
                for row in constructor_rows:
                    constructor_data = row.get("Constructor", {})
                    team_name = str(constructor_data.get("name", "Unknown Team")).strip() or "Unknown Team"
                    team = _find_or_create_team(db, series.id, team_name)

                    position = int(str(row.get("position", "0")).strip() or 0)
                    points = float(str(row.get("points", "0")).strip() or 0)
                    wins = int(str(row.get("wins", "0")).strip() or 0)
                    if position <= 0:
                        continue

                    _upsert_constructor_standing(db, season.id, team.id, "Overall", position, points, wins)

        logger.info("Synced official F1 standings for %d", year)
        return True

    def sync_derived_standings_from_results(
        self, series_slug: str, year: int, points_table: Optional[list[int]] = None
    ) -> bool:
        """Build standings from stored race results when official standings are unavailable."""
        table = points_table or DEFAULT_POINTS_TABLE

        with db_session() as db:
            series, season = _get_series_and_season(db, series_slug, year)
            if not series or not season:
                return False

            race_sessions = (
                db.query(Session)
                .join(Session.event)
                .filter(Session.type == "race", Session.event.has(season_id=season.id))
                .all()
            )
            if not race_sessions:
                return False

            driver_totals: dict[str, dict[int, dict[str, float]]] = defaultdict(
                lambda: defaultdict(lambda: {"points": 0.0, "wins": 0.0})
            )
            constructor_totals: dict[str, dict[int, dict[str, float]]] = defaultdict(
                lambda: defaultdict(lambda: {"points": 0.0, "wins": 0.0})
            )
            scored_any = False

            for race_session in race_sessions:
                results = (
                    db.query(Result)
                    .filter(Result.session_id == race_session.id)
                    .order_by(Result.position.asc())
                    .all()
                )
                for result in results:
                    position = result.position or 0
                    if position <= 0 or not result.driver:
                        continue

                    points = _points_for_position(position, table)
                    if points <= 0:
                        continue

                    class_name = str(result.class_name or "Overall").strip() or "Overall"
                    scored_any = True
                    driver_totals[class_name][result.driver_id]["points"] += points
                    if position == 1:
                        driver_totals[class_name][result.driver_id]["wins"] += 1

                    team_id = result.driver.team_id
                    if team_id:
                        constructor_totals[class_name][team_id]["points"] += points
                        if position == 1:
                            constructor_totals[class_name][team_id]["wins"] += 1

            if not scored_any:
                return False

            db.query(DriverStanding).filter(DriverStanding.season_id == season.id).delete(synchronize_session=False)
            db.query(ConstructorStanding).filter(ConstructorStanding.season_id == season.id).delete(synchronize_session=False)

            for class_name, class_driver_totals in driver_totals.items():
                ranked_drivers = sorted(
                    class_driver_totals.items(),
                    key=lambda item: (-item[1]["points"], -item[1]["wins"], item[0]),
                )
                for idx, (driver_id, agg) in enumerate(ranked_drivers, start=1):
                    _upsert_driver_standing(
                        db,
                        season.id,
                        driver_id,
                        class_name,
                        idx,
                        agg["points"],
                        int(agg["wins"]),
                    )

            for class_name, class_constructor_totals in constructor_totals.items():
                ranked_constructors = sorted(
                    class_constructor_totals.items(),
                    key=lambda item: (-item[1]["points"], -item[1]["wins"], item[0]),
                )
                for idx, (team_id, agg) in enumerate(ranked_constructors, start=1):
                    _upsert_constructor_standing(
                        db,
                        season.id,
                        team_id,
                        class_name,
                        idx,
                        agg["points"],
                        int(agg["wins"]),
                    )

        logger.info("Synced derived standings for %s %d", series_slug.upper(), year)
        return True

    def sync_all_for_year(self, year: int) -> None:
        """Sync standings for all supported series for a given year."""
        f1_synced = self.sync_f1_official_standings(year)
        if not f1_synced:
            self.sync_derived_standings_from_results(F1_SERIES_SLUG, year)

        self.sync_derived_standings_from_results("wec", year)
        self.sync_derived_standings_from_results("imsa", year)
