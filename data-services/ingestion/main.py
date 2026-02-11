import logging
import time
from datetime import date, datetime, timedelta, timezone

import schedule

from ingestion.f1_ingestion import F1Ingestion
from ingestion.wec_ingestion import WecIngestion
from ingestion.feed_generator import FeedGenerator
from ingestion.config import db_session
from ingestion.models import Event, Session, Result, Season

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def current_year() -> int:
    return datetime.now(timezone.utc).year


def previous_year() -> int:
    return current_year() - 1


def update_event_statuses() -> None:
    """Update event statuses: upcoming -> live -> completed based on session times."""
    try:
        now = datetime.now(timezone.utc)
        today = now.date()

        with db_session() as db:
            past_events = (
                db.query(Event)
                .filter(Event.end_date < today, Event.status != "completed")
                .all()
            )
            for event in past_events:
                event.status = "completed"

            active_events = (
                db.query(Event)
                .filter(Event.status.in_(["upcoming", "live"]))
                .all()
            )
            for event in active_events:
                sessions = db.query(Session).filter(Session.event_id == event.id).all()
                is_live = any(
                    session.start_time and session.start_time <= now <= (session.end_time or session.start_time + timedelta(hours=3))
                    for session in sessions
                )

                if is_live and event.status != "live":
                    event.status = "live"
                    logger.info("Event now LIVE: %s", event.name)
                elif not is_live and event.status == "live":
                    if event.end_date and event.end_date < today:
                        event.status = "completed"
                    else:
                        event.status = "upcoming"

            logger.info("Status update: %d events marked completed.", len(past_events))

    except Exception:
        logger.exception("Error updating event statuses")


def get_event_slugs_needing_results(year: int) -> list[str]:
    """Find event slugs that have completed but don't have results in the DB yet."""
    try:
        with db_session() as db:
            today = date.today()
            events = (
                db.query(Event)
                .join(Event.season)
                .filter(Season.year == year, Event.end_date < today)
                .all()
            )

            slugs_needing_results = []
            for event in events:
                sessions = db.query(Session).filter(Session.event_id == event.id).all()
                for session in sessions:
                    if session.type in ("race", "qualifying", "sprint"):
                        result_count = db.query(Result).filter(Result.session_id == session.id).count()
                        if result_count == 0:
                            slugs_needing_results.append(event.slug)
                            break

            return slugs_needing_results

    except Exception:
        logger.exception("Error checking events needing results")
        return []


def run_initial_sync() -> None:
    """Run the initial data sync on startup."""
    logger.info("Starting initial data sync...")

    f1 = F1Ingestion()
    wec = WecIngestion()
    feed = FeedGenerator()

    prev = previous_year()
    curr = current_year()

    f1.sync_calendar(prev)
    f1.sync_calendar(curr)
    wec.sync_calendar(prev)
    wec.sync_calendar(curr)

    update_event_statuses()

    for year in [prev, curr]:
        missing_slugs = get_event_slugs_needing_results(year)
        if missing_slugs:
            logger.info("F1 %d: syncing results for %d events", year, len(missing_slugs))
            for slug in missing_slugs:
                try:
                    f1.sync_all_session_results_by_slug(year, slug)
                except Exception:
                    logger.warning("Could not sync F1 %d %s results", year, slug)
        else:
            logger.info("F1 %d: all results up to date", year)

    feed.generate_upcoming_previews()
    logger.info("Initial data sync complete.")


def scheduled_status_check() -> None:
    """Runs every 5 minutes to detect live events and update statuses."""
    update_event_statuses()


def scheduled_results_check() -> None:
    """Runs hourly to sync any missing results."""
    f1 = F1Ingestion()
    for year in [previous_year(), current_year()]:
        missing_slugs = get_event_slugs_needing_results(year)
        for slug in missing_slugs:
            try:
                f1.sync_all_session_results_by_slug(year, slug)
            except Exception:
                logger.warning("Could not sync F1 %d %s results", year, slug)


def scheduled_generate_previews() -> None:
    logger.info("Running scheduled preview generation...")
    FeedGenerator().generate_upcoming_previews()


def main() -> None:
    logger.info("Pitwall Data Services starting up...")

    run_initial_sync()

    schedule.every(5).minutes.do(scheduled_status_check)
    schedule.every(1).hours.do(scheduled_results_check)
    schedule.every(6).hours.do(scheduled_generate_previews)

    logger.info("Scheduled tasks registered. Entering main loop...")

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
