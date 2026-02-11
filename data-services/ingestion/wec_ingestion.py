import logging
from typing import Optional

from sqlalchemy.orm import Session as DbSession

from ingestion.config import SessionLocal
from ingestion.models import Series

logger = logging.getLogger(__name__)


class WecIngestion:
    """Handles ingestion of FIA World Endurance Championship data.

    Currently no free API exists for WEC data (unlike FastF1 for Formula 1).
    This class is a placeholder for future integration with a WEC data source.
    """

    def _get_series(self, db: DbSession) -> Optional[Series]:
        series = db.query(Series).filter(Series.slug == "wec").first()
        if not series:
            logger.error("WEC series not found in database. Ensure seed data exists.")
        return series

    def sync_calendar(self, year: int) -> None:
        logger.info(
            "WEC %d calendar sync skipped — no data source available. "
            "Integrate a WEC API or scraper to populate this data.",
            year,
        )

    def sync_results(self, event_slug: str) -> None:
        logger.info("WEC results sync not yet implemented (event_slug=%s)", event_slug)
