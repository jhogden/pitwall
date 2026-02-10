import logging
from datetime import datetime
from typing import Optional

import fastf1
from sqlalchemy.orm import Session as DbSession

from ingestion.config import SessionLocal
from ingestion.models import Series, Season, Circuit, Event, Session, Team, Driver, Result, FeedItem

logger = logging.getLogger(__name__)


def _slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    return text.lower().replace(" ", "-").replace(".", "").replace("'", "")


class F1Ingestion:
    """Handles ingestion of Formula 1 data via the fastf1 library."""

    SESSION_TYPE_MAP = {
        "Practice 1": "practice",
        "Practice 2": "practice",
        "Practice 3": "practice",
        "Sprint Shootout": "sprint_qualifying",
        "Sprint Qualifying": "sprint_qualifying",
        "Sprint": "sprint",
        "Qualifying": "qualifying",
        "Race": "race",
    }

    def _get_series(self, db: DbSession) -> Optional[Series]:
        """Look up the F1 series by slug."""
        series = db.query(Series).filter(Series.slug == "f1").first()
        if not series:
            logger.error("F1 series not found in database. Ensure seed data exists.")
        return series

    def _find_or_create_circuit(self, db: DbSession, name: str, country: str) -> Circuit:
        """Find an existing circuit by slug or create a new one."""
        slug = _slugify(name)
        circuit = db.query(Circuit).filter(Circuit.slug == slug).first()
        if not circuit:
            circuit = Circuit(name=name, slug=slug, country=country)
            db.add(circuit)
            db.flush()
            logger.info("Created circuit: %s (%s)", name, country)
        return circuit

    def _find_or_create_season(self, db: DbSession, series_id: int, year: int) -> Season:
        """Find an existing season or create a new one."""
        season = db.query(Season).filter(
            Season.series_id == series_id, Season.year == year
        ).first()
        if not season:
            season = Season(series_id=series_id, year=year)
            db.add(season)
            db.flush()
            logger.info("Created season: F1 %d", year)
        return season

    def _find_or_create_team(self, db: DbSession, series_id: int, team_name: str) -> Team:
        """Find an existing team by slug or create a new one."""
        slug = _slugify(team_name)
        team = db.query(Team).filter(Team.series_id == series_id, Team.slug == slug).first()
        if not team:
            team = Team(series_id=series_id, name=team_name, slug=slug)
            db.add(team)
            db.flush()
            logger.info("Created team: %s", team_name)
        return team

    def _find_or_create_driver(
        self, db: DbSession, series_id: int, first_name: str, last_name: str,
        abbreviation: str, number: Optional[int], team_id: Optional[int]
    ) -> Driver:
        """Find an existing driver by slug or create a new one."""
        slug = _slugify(f"{first_name}-{last_name}")
        driver = db.query(Driver).filter(
            Driver.series_id == series_id, Driver.slug == slug
        ).first()
        if not driver:
            driver = Driver(
                series_id=series_id,
                team_id=team_id,
                first_name=first_name,
                last_name=last_name,
                slug=slug,
                number=number,
                abbreviation=abbreviation,
            )
            db.add(driver)
            db.flush()
            logger.info("Created driver: %s %s (%s)", first_name, last_name, abbreviation)
        else:
            if team_id and driver.team_id != team_id:
                driver.team_id = team_id
        return driver

    def sync_calendar(self, year: int) -> None:
        """Sync the F1 calendar for a given year using fastf1."""
        logger.info("Syncing F1 %d calendar...", year)
        db = SessionLocal()
        try:
            series = self._get_series(db)
            if not series:
                return

            season = self._find_or_create_season(db, series.id, year)

            schedule = fastf1.get_event_schedule(year)
            for _, event_row in schedule.iterrows():
                event_name = str(event_row.get("EventName", ""))
                if not event_name or event_name == "nan":
                    continue

                country = str(event_row.get("Country", ""))
                location = str(event_row.get("Location", ""))
                round_number = int(event_row.get("RoundNumber", 0))

                if round_number == 0:
                    continue

                circuit = self._find_or_create_circuit(db, location, country)
                event_slug = _slugify(f"{year}-{event_name}")

                event = db.query(Event).filter(
                    Event.series_id == series.id, Event.slug == event_slug
                ).first()

                event_date = event_row.get("EventDate")
                start_date = event_date.date() if hasattr(event_date, "date") else None

                if not event:
                    event = Event(
                        series_id=series.id,
                        circuit_id=circuit.id,
                        season_id=season.id,
                        name=event_name,
                        slug=event_slug,
                        round_number=round_number,
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

                # Create sessions for each session type
                session_columns = [
                    ("Session1", "Session1Date"),
                    ("Session2", "Session2Date"),
                    ("Session3", "Session3Date"),
                    ("Session4", "Session4Date"),
                    ("Session5", "Session5Date"),
                ]
                for session_col, date_col in session_columns:
                    session_name = str(event_row.get(session_col, ""))
                    if not session_name or session_name == "nan":
                        continue

                    session_slug = _slugify(f"{event_slug}-{session_name}")
                    session_type = self.SESSION_TYPE_MAP.get(session_name, "other")

                    existing_session = db.query(Session).filter(
                        Session.event_id == event.id, Session.slug == session_slug
                    ).first()

                    session_date = event_row.get(date_col)
                    scheduled_start = session_date if hasattr(session_date, "hour") else None

                    if not existing_session:
                        new_session = Session(
                            event_id=event.id,
                            name=session_name,
                            slug=session_slug,
                            session_type=session_type,
                            scheduled_start=scheduled_start,
                            status="upcoming",
                        )
                        db.add(new_session)

                db.flush()

            db.commit()
            logger.info("F1 %d calendar sync complete.", year)

        except Exception:
            db.rollback()
            logger.exception("Error syncing F1 %d calendar", year)
        finally:
            db.close()

    def sync_results(self, year: int, round_number: int) -> None:
        """Sync race results for a specific F1 round using fastf1."""
        logger.info("Syncing F1 %d Round %d results...", year, round_number)
        db = SessionLocal()
        try:
            series = self._get_series(db)
            if not series:
                return

            # Load the session via fastf1
            f1_session = fastf1.get_session(year, round_number, "R")
            f1_session.load()

            results_df = f1_session.results
            if results_df is None or results_df.empty:
                logger.warning("No results found for F1 %d Round %d", year, round_number)
                return

            # Find the corresponding event and race session in the database
            event_slug_prefix = f"{year}-"
            event = db.query(Event).filter(
                Event.series_id == series.id,
                Event.round_number == round_number,
                Event.slug.like(f"{event_slug_prefix}%"),
            ).first()

            if not event:
                logger.error("Event not found for F1 %d Round %d", year, round_number)
                return

            race_session = db.query(Session).filter(
                Session.event_id == event.id,
                Session.session_type == "race",
            ).first()

            if not race_session:
                logger.error("Race session not found for event: %s", event.name)
                return

            for _, row in results_df.iterrows():
                first_name = str(row.get("FirstName", ""))
                last_name = str(row.get("LastName", ""))
                abbreviation = str(row.get("Abbreviation", ""))
                team_name = str(row.get("TeamName", ""))
                driver_number = int(row.get("DriverNumber", 0)) if row.get("DriverNumber") else None
                position = int(row.get("Position", 0)) if row.get("Position") else None
                grid_position = int(row.get("GridPosition", 0)) if row.get("GridPosition") else None
                points = float(row.get("Points", 0.0)) if row.get("Points") else 0.0
                status = str(row.get("Status", ""))

                team = self._find_or_create_team(db, series.id, team_name)
                driver = self._find_or_create_driver(
                    db, series.id, first_name, last_name,
                    abbreviation, driver_number, team.id
                )

                existing_result = db.query(Result).filter(
                    Result.session_id == race_session.id,
                    Result.driver_id == driver.id,
                ).first()

                if existing_result:
                    existing_result.position = position
                    existing_result.grid_position = grid_position
                    existing_result.points = points
                    existing_result.status = status
                    existing_result.team_id = team.id
                else:
                    result = Result(
                        session_id=race_session.id,
                        driver_id=driver.id,
                        team_id=team.id,
                        position=position,
                        grid_position=grid_position,
                        points=points,
                        status=status,
                    )
                    db.add(result)

            race_session.status = "completed"
            event.status = "completed"

            # Create a feed item summarizing the race result
            top_results = results_df.sort_values("Position").head(3)
            if len(top_results) >= 3:
                p1 = f"{top_results.iloc[0]['FirstName']} {top_results.iloc[0]['LastName']}"
                p2 = f"{top_results.iloc[1]['FirstName']} {top_results.iloc[1]['LastName']}"
                p3 = f"{top_results.iloc[2]['FirstName']} {top_results.iloc[2]['LastName']}"
                summary = (
                    f"{p1} wins the {event.name}! "
                    f"{p2} finishes P2, {p3} P3."
                )
                feed_item = FeedItem(
                    series_id=series.id,
                    item_type="race_result",
                    title=f"{event.name} - Race Result",
                    summary=summary,
                    published_at=datetime.utcnow(),
                )
                db.add(feed_item)

            db.commit()
            logger.info("F1 %d Round %d results sync complete.", year, round_number)

        except Exception:
            db.rollback()
            logger.exception("Error syncing F1 %d Round %d results", year, round_number)
        finally:
            db.close()

    def generate_preview(self, event_name: str, event_date: str) -> None:
        """Create a feed item preview for an upcoming race."""
        logger.info("Generating preview for %s on %s", event_name, event_date)
        db = SessionLocal()
        try:
            series = self._get_series(db)
            if not series:
                return

            title = f"Race Preview: {event_name}"
            summary = (
                f"The {event_name} is coming up on {event_date}. "
                f"Get ready for another exciting round of the F1 World Championship!"
            )
            feed_item = FeedItem(
                series_id=series.id,
                item_type="preview",
                title=title,
                summary=summary,
                published_at=datetime.utcnow(),
            )
            db.add(feed_item)
            db.commit()
            logger.info("Preview feed item created for %s", event_name)

        except Exception:
            db.rollback()
            logger.exception("Error generating preview for %s", event_name)
        finally:
            db.close()
