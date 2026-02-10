import logging
import time

import schedule

from ingestion.f1_ingestion import F1Ingestion
from ingestion.wec_ingestion import WecIngestion
from ingestion.feed_generator import FeedGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

CURRENT_YEAR = 2025


def run_initial_sync() -> None:
    """Run the initial data sync on startup."""
    logger.info("Starting initial data sync...")

    f1 = F1Ingestion()
    wec = WecIngestion()
    feed = FeedGenerator()

    # Sync calendars
    f1.sync_calendar(CURRENT_YEAR)
    wec.sync_calendar(CURRENT_YEAR)

    # Generate previews for upcoming events
    feed.generate_upcoming_previews()

    logger.info("Initial data sync complete.")


def scheduled_generate_previews() -> None:
    """Scheduled task: generate previews for upcoming events."""
    logger.info("Running scheduled preview generation...")
    feed = FeedGenerator()
    feed.generate_upcoming_previews()


def scheduled_check_results() -> None:
    """Scheduled task: check for completed sessions and generate result summaries.

    This is a placeholder -- in a full implementation, it would query for
    sessions that have recently completed and generate summaries for them.
    """
    logger.info("Running scheduled results check (placeholder)...")
    # TODO: Query sessions with status='completed' that don't have feed items yet,
    # then call feed_generator.generate_race_result_summary() for each.


def main() -> None:
    """Main entry point for the data services."""
    logger.info("Pitwall Data Services starting up...")

    # Run initial sync
    run_initial_sync()

    # Schedule periodic tasks
    schedule.every(6).hours.do(scheduled_generate_previews)
    schedule.every(1).hours.do(scheduled_check_results)

    logger.info("Scheduled tasks registered. Entering main loop...")

    # Run the schedule loop
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
