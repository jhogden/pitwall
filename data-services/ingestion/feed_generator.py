import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from ingestion.config import db_session
from ingestion.models import Event, Session, Result, Driver, FeedItem

logger = logging.getLogger(__name__)


def build_result_summary(event_name: str, winner: str, second: str, third: str) -> str:
    return f"{winner} wins the {event_name}! {second} finishes P2, {third} P3."


class FeedGenerator:

    def generate_race_result_summary(self, session_id: int) -> Optional[str]:
        logger.info("Generating race result summary for session_id=%d", session_id)
        try:
            with db_session() as db:
                session = db.query(Session).filter(Session.id == session_id).first()
                if not session:
                    logger.error("Session not found: %d", session_id)
                    return None

                event = db.query(Event).filter(Event.id == session.event_id).first()
                if not event:
                    logger.error("Event not found for session: %d", session_id)
                    return None

                results = (
                    db.query(Result)
                    .filter(Result.session_id == session_id)
                    .order_by(Result.position)
                    .limit(3)
                    .all()
                )

                if len(results) < 3:
                    logger.warning(
                        "Not enough results for summary (session_id=%d, count=%d)",
                        session_id, len(results),
                    )
                    return None

                drivers = []
                for result in results:
                    driver = db.query(Driver).filter(Driver.id == result.driver_id).first()
                    drivers.append(driver.name if driver else "Unknown Driver")

                summary = build_result_summary(event.name, drivers[0], drivers[1], drivers[2])
                series_id = event.season.series_id if event.season else None

                existing_feed = (
                    db.query(FeedItem)
                    .filter(FeedItem.event_id == event.id, FeedItem.type == "race_result")
                    .first()
                )

                if existing_feed:
                    existing_feed.summary = summary
                else:
                    db.add(FeedItem(
                        type="race_result",
                        series_id=series_id,
                        event_id=event.id,
                        title=f"{event.name} - Race Result",
                        summary=summary,
                        published_at=datetime.now(timezone.utc),
                    ))

                logger.info("Race result summary created for %s", event.name)
                return summary

        except Exception:
            logger.exception("Error generating race result summary for session %d", session_id)
            return None

    def generate_upcoming_previews(self) -> int:
        logger.info("Generating upcoming event previews...")
        count = 0
        try:
            now = datetime.now(timezone.utc).date()
            upcoming_cutoff = now + timedelta(days=7)

            with db_session() as db:
                events = (
                    db.query(Event)
                    .filter(
                        Event.status == "upcoming",
                        Event.start_date >= now,
                        Event.start_date <= upcoming_cutoff,
                    )
                    .all()
                )

                for event in events:
                    existing = (
                        db.query(FeedItem)
                        .filter(FeedItem.event_id == event.id, FeedItem.type == "preview")
                        .first()
                    )
                    if existing:
                        continue

                    series_id = event.season.series_id if event.season else None
                    db.add(FeedItem(
                        type="preview",
                        series_id=series_id,
                        event_id=event.id,
                        title=f"Race Preview: {event.name}",
                        summary=f"The {event.name} is coming up on {event.start_date}. Don't miss the action!",
                        published_at=datetime.now(timezone.utc),
                    ))
                    count += 1

            logger.info("Created %d upcoming preview feed items.", count)
            return count

        except Exception:
            logger.exception("Error generating upcoming previews")
            return 0
