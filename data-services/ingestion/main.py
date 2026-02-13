import logging
import os
import time
from datetime import date, datetime, timedelta, timezone

import schedule

from ingestion.f1_ingestion import F1Ingestion
from ingestion.imsa_ingestion import ImsaIngestion
from ingestion.wec_ingestion import WecIngestion
from ingestion.feed_generator import FeedGenerator
from ingestion.config import db_session
from ingestion.models import Event, Session, Result, Season, Series

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


def next_year() -> int:
    return current_year() + 1


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


def get_event_slugs_needing_results(year: int, series_slug: str = "f1") -> list[str]:
    """Find event slugs that have completed but don't have results in the DB yet."""
    try:
        with db_session() as db:
            today = date.today()
            events = (
                db.query(Event)
                .join(Event.season)
                .join(Season.series)
                .filter(
                    Season.year == year,
                    Series.slug == series_slug,
                    Event.end_date < today,
                )
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


def _season_has_results(year: int) -> bool:
    """Check if a season already has events with results in the DB."""
    try:
        with db_session() as db:
            season = db.query(Season).filter(Season.year == year).first()
            if not season:
                return False
            events = db.query(Event).filter(Event.season_id == season.id).all()
            if not events:
                return False
            for event in events:
                sessions = db.query(Session).filter(Session.event_id == event.id).all()
                for session in sessions:
                    if db.query(Result).filter(Result.session_id == session.id).count() > 0:
                        return True
            return False
    except Exception:
        logger.exception("Error checking season %d", year)
        return False


def _season_has_events(series_slug: str, year: int) -> bool:
    """Check if a season already has events in the DB."""
    try:
        with db_session() as db:
            season = (
                db.query(Season)
                .join(Season.series)
                .filter(Season.year == year, Series.slug == series_slug)
                .first()
            )
            if not season:
                return False
            return db.query(Event).filter(Event.season_id == season.id).count() > 0
    except Exception:
        logger.exception("Error checking %s season %d", series_slug, year)
        return False


def _sync_calendar_safely(ingester, series_slug: str, year: int) -> None:
    """Sync a series calendar and continue on provider gaps/errors."""
    try:
        ingester.sync_calendar(year)
    except Exception:
        logger.warning("Could not sync %s %d calendar", series_slug.upper(), year, exc_info=True)


def run_historical_sync(start_year: int, end_year: int) -> None:
    """Sync historical F1 seasons from start_year to end_year (inclusive)."""
    logger.info("Starting historical sync: %d to %d", start_year, end_year)
    f1 = F1Ingestion()

    for year in range(start_year, end_year + 1):
        if _season_has_results(year):
            logger.info("Skipping %d — already has results", year)
            continue
        try:
            f1.sync_historical_season(year)
        except Exception:
            logger.exception("Failed to sync historical season %d", year)
        time.sleep(5)

    logger.info("Historical sync complete.")


def run_series_calendar_backfill(series_slug: str, start_year: int, end_year: int) -> None:
    """Backfill calendars for non-F1 series."""
    logger.info("Starting %s calendar backfill: %d to %d", series_slug.upper(), start_year, end_year)

    if series_slug == "wec":
        ingester = WecIngestion()
    elif series_slug == "imsa":
        ingester = ImsaIngestion()
    else:
        logger.error("Unsupported series for backfill: %s", series_slug)
        return

    for year in range(start_year, end_year + 1):
        if _season_has_events(series_slug, year):
            logger.info("Skipping %s %d — events already exist", series_slug.upper(), year)
            continue
        try:
            ingester.sync_calendar(year)
        except Exception:
            logger.exception("Failed to backfill %s %d calendar", series_slug.upper(), year)
        time.sleep(2)

    logger.info("%s calendar backfill complete.", series_slug.upper())


def run_initial_sync() -> None:
    """Run the initial data sync on startup."""
    logger.info("Starting initial data sync...")

    f1 = F1Ingestion()
    imsa = ImsaIngestion()
    wec = WecIngestion()
    feed = FeedGenerator()

    prev = previous_year()
    curr = current_year()
    nxt = next_year()

    for year in [prev, curr, nxt]:
        _sync_calendar_safely(f1, "f1", year)
        _sync_calendar_safely(imsa, "imsa", year)
        _sync_calendar_safely(wec, "wec", year)

    update_event_statuses()

    for year in [prev, curr]:
        missing_slugs = get_event_slugs_needing_results(year, series_slug="f1")
        if missing_slugs:
            logger.info("F1 %d: syncing results for %d events", year, len(missing_slugs))
            for slug in missing_slugs:
                try:
                    f1.sync_all_session_results_by_slug(year, slug)
                except Exception:
                    logger.warning("Could not sync F1 %d %s results", year, slug)
        else:
            logger.info("F1 %d: all results up to date", year)

    wec.sync_results_for_year(prev)
    wec.sync_results_for_year(curr)
    imsa.sync_results_for_year(prev)
    imsa.sync_results_for_year(curr)
    imsa.sync_lap_telemetry_for_year(prev)
    imsa.sync_lap_telemetry_for_year(curr)

    feed.generate_upcoming_previews()
    logger.info("Initial data sync complete.")


def scheduled_status_check() -> None:
    """Runs every 5 minutes to detect live events and update statuses."""
    update_event_statuses()


def scheduled_results_check() -> None:
    """Runs hourly to sync any missing results."""
    f1 = F1Ingestion()
    wec = WecIngestion()
    imsa = ImsaIngestion()
    for year in [previous_year(), current_year()]:
        missing_slugs = get_event_slugs_needing_results(year, series_slug="f1")
        for slug in missing_slugs:
            try:
                f1.sync_all_session_results_by_slug(year, slug)
            except Exception:
                logger.warning("Could not sync F1 %d %s results", year, slug)
    wec.sync_results_for_year(current_year())
    imsa.sync_results_for_year(previous_year())
    imsa.sync_results_for_year(current_year())
    imsa.sync_lap_telemetry_for_year(previous_year())
    imsa.sync_lap_telemetry_for_year(current_year())


def scheduled_generate_previews() -> None:
    logger.info("Running scheduled preview generation...")
    FeedGenerator().generate_upcoming_previews()


def scheduled_calendar_refresh() -> None:
    """Refresh current and next year calendars to keep upcoming events prepared."""
    logger.info("Running scheduled calendar refresh...")
    curr = current_year()
    nxt = next_year()
    f1 = F1Ingestion()
    wec = WecIngestion()
    imsa = ImsaIngestion()
    for year in [curr, nxt]:
        _sync_calendar_safely(f1, "f1", year)
        _sync_calendar_safely(wec, "wec", year)
        _sync_calendar_safely(imsa, "imsa", year)


def main() -> None:
    logger.info("Pitwall Data Services starting up...")

    historical_sync = os.getenv("HISTORICAL_SYNC")
    if historical_sync:
        try:
            start_str, end_str = historical_sync.split("-", 1)
            run_historical_sync(int(start_str), int(end_str))
        except ValueError:
            logger.error("Invalid HISTORICAL_SYNC format. Expected 'START-END' (e.g. '1950-2024').")

    wec_backfill = os.getenv("WEC_HISTORICAL_SYNC")
    if wec_backfill:
        try:
            start_str, end_str = wec_backfill.split("-", 1)
            run_series_calendar_backfill("wec", int(start_str), int(end_str))
        except ValueError:
            logger.error("Invalid WEC_HISTORICAL_SYNC format. Expected 'START-END' (e.g. '2012-2025').")

    imsa_backfill = os.getenv("IMSA_HISTORICAL_SYNC")
    if imsa_backfill:
        try:
            start_str, end_str = imsa_backfill.split("-", 1)
            run_series_calendar_backfill("imsa", int(start_str), int(end_str))
        except ValueError:
            logger.error("Invalid IMSA_HISTORICAL_SYNC format. Expected 'START-END' (e.g. '2014-2025').")

    run_initial_sync()

    schedule.every(5).minutes.do(scheduled_status_check)
    schedule.every(1).hours.do(scheduled_results_check)
    schedule.every(6).hours.do(scheduled_generate_previews)
    schedule.every(24).hours.do(scheduled_calendar_refresh)

    logger.info("Scheduled tasks registered. Entering main loop...")

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
