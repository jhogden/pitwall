import logging
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session as DbSession

from ingestion.config import SessionLocal
from ingestion.models import Series, Season, Circuit, Event, Session

logger = logging.getLogger(__name__)


def _slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    return text.lower().replace(" ", "-").replace(".", "").replace("'", "")


# Hardcoded 2025 WEC calendar since scraping fiawec.alkamelsystems.com is complex
WEC_2025_CALENDAR = [
    {
        "name": "Qatar 1812 km",
        "circuit": "Lusail International Circuit",
        "country": "Qatar",
        "city": "Lusail",
        "start_date": date(2025, 2, 28),
        "end_date": date(2025, 2, 28),
        "round_number": 1,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Qualifying", "type": "qualifying"},
            {"name": "Race", "type": "race"},
        ],
    },
    {
        "name": "Imola 6 Hours",
        "circuit": "Autodromo Enzo e Dino Ferrari",
        "country": "Italy",
        "city": "Imola",
        "start_date": date(2025, 4, 20),
        "end_date": date(2025, 4, 20),
        "round_number": 2,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Qualifying", "type": "qualifying"},
            {"name": "Race", "type": "race"},
        ],
    },
    {
        "name": "Spa 6 Hours",
        "circuit": "Circuit de Spa-Francorchamps",
        "country": "Belgium",
        "city": "Spa",
        "start_date": date(2025, 5, 10),
        "end_date": date(2025, 5, 10),
        "round_number": 3,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Qualifying", "type": "qualifying"},
            {"name": "Race", "type": "race"},
        ],
    },
    {
        "name": "Le Mans 24 Hours",
        "circuit": "Circuit de la Sarthe",
        "country": "France",
        "city": "Le Mans",
        "start_date": date(2025, 6, 14),
        "end_date": date(2025, 6, 15),
        "round_number": 4,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Free Practice 3", "type": "practice"},
            {"name": "Hyperpole", "type": "qualifying"},
            {"name": "Warm Up", "type": "practice"},
            {"name": "Race", "type": "race"},
        ],
    },
    {
        "name": "São Paulo 6 Hours",
        "circuit": "Autódromo José Carlos Pace",
        "country": "Brazil",
        "city": "São Paulo",
        "start_date": date(2025, 7, 13),
        "end_date": date(2025, 7, 13),
        "round_number": 5,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Qualifying", "type": "qualifying"},
            {"name": "Race", "type": "race"},
        ],
    },
    {
        "name": "COTA 6 Hours",
        "circuit": "Circuit of the Americas",
        "country": "United States",
        "city": "Austin",
        "start_date": date(2025, 9, 7),
        "end_date": date(2025, 9, 7),
        "round_number": 6,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Qualifying", "type": "qualifying"},
            {"name": "Race", "type": "race"},
        ],
    },
    {
        "name": "Fuji 6 Hours",
        "circuit": "Fuji Speedway",
        "country": "Japan",
        "city": "Oyama",
        "start_date": date(2025, 9, 28),
        "end_date": date(2025, 9, 28),
        "round_number": 7,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Qualifying", "type": "qualifying"},
            {"name": "Race", "type": "race"},
        ],
    },
    {
        "name": "Bahrain 8 Hours",
        "circuit": "Bahrain International Circuit",
        "country": "Bahrain",
        "city": "Sakhir",
        "start_date": date(2025, 11, 1),
        "end_date": date(2025, 11, 1),
        "round_number": 8,
        "sessions": [
            {"name": "Free Practice 1", "type": "practice"},
            {"name": "Free Practice 2", "type": "practice"},
            {"name": "Qualifying", "type": "qualifying"},
            {"name": "Race", "type": "race"},
        ],
    },
]


class WecIngestion:
    """Handles ingestion of FIA World Endurance Championship data."""

    def _get_series(self, db: DbSession) -> Optional[Series]:
        """Look up the WEC series by slug."""
        series = db.query(Series).filter(Series.slug == "wec").first()
        if not series:
            logger.error("WEC series not found in database. Ensure seed data exists.")
        return series

    def _find_or_create_circuit(
        self, db: DbSession, name: str, country: str, city: str
    ) -> Circuit:
        """Find an existing circuit by slug or create a new one."""
        slug = _slugify(name)
        circuit = db.query(Circuit).filter(Circuit.slug == slug).first()
        if not circuit:
            circuit = Circuit(name=name, slug=slug, country=country, city=city)
            db.add(circuit)
            db.flush()
            logger.info("Created circuit: %s (%s, %s)", name, city, country)
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
            logger.info("Created season: WEC %d", year)
        return season

    def sync_calendar(self, year: int) -> None:
        """Sync the WEC calendar for a given year using hardcoded data."""
        if year != 2025:
            logger.warning("WEC calendar data is only available for 2025 (requested %d)", year)
            return

        logger.info("Syncing WEC %d calendar...", year)
        db = SessionLocal()
        try:
            series = self._get_series(db)
            if not series:
                return

            season = self._find_or_create_season(db, series.id, year)

            for event_data in WEC_2025_CALENDAR:
                circuit = self._find_or_create_circuit(
                    db,
                    event_data["circuit"],
                    event_data["country"],
                    event_data.get("city", ""),
                )

                event_slug = _slugify(f"{year}-{event_data['name']}")
                event = db.query(Event).filter(
                    Event.series_id == series.id, Event.slug == event_slug
                ).first()

                if not event:
                    event = Event(
                        series_id=series.id,
                        circuit_id=circuit.id,
                        season_id=season.id,
                        name=event_data["name"],
                        slug=event_slug,
                        round_number=event_data["round_number"],
                        start_date=event_data["start_date"],
                        end_date=event_data["end_date"],
                        status="upcoming",
                    )
                    db.add(event)
                    db.flush()
                    logger.info(
                        "Created WEC event: %s (Round %d)",
                        event_data["name"],
                        event_data["round_number"],
                    )
                else:
                    event.circuit_id = circuit.id
                    event.start_date = event_data["start_date"]
                    event.end_date = event_data["end_date"]

                for session_data in event_data["sessions"]:
                    session_slug = _slugify(f"{event_slug}-{session_data['name']}")
                    existing_session = db.query(Session).filter(
                        Session.event_id == event.id, Session.slug == session_slug
                    ).first()

                    if not existing_session:
                        new_session = Session(
                            event_id=event.id,
                            name=session_data["name"],
                            slug=session_slug,
                            session_type=session_data["type"],
                            status="upcoming",
                        )
                        db.add(new_session)

                db.flush()

            db.commit()
            logger.info("WEC %d calendar sync complete.", year)

        except Exception:
            db.rollback()
            logger.exception("Error syncing WEC %d calendar", year)
        finally:
            db.close()

    def sync_results(self, event_slug: str) -> None:
        """Sync results for a WEC event. Not yet implemented."""
        logger.info("WEC results sync not yet implemented (event_slug=%s)", event_slug)
