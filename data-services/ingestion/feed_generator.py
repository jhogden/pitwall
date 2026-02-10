import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session as DbSession

from ingestion.config import SessionLocal
from ingestion.models import Series, Event, Session, Result, Driver, FeedItem

logger = logging.getLogger(__name__)


class FeedGenerator:
    """Generates feed items for the Pitwall app."""

    def generate_race_result_summary(self, session_id: int) -> Optional[str]:
        """Query results for a session and build a summary feed item.

        Args:
            session_id: The database ID of the race session.

        Returns:
            The summary string if successful, None otherwise.
        """
        logger.info("Generating race result summary for session_id=%d", session_id)
        db = SessionLocal()
        try:
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
                    session_id,
                    len(results),
                )
                return None

            drivers = []
            for result in results:
                driver = db.query(Driver).filter(Driver.id == result.driver_id).first()
                if driver:
                    drivers.append(f"{driver.first_name} {driver.last_name}")
                else:
                    drivers.append("Unknown Driver")

            summary = build_result_summary(event.name, drivers[0], drivers[1], drivers[2])

            # Create or update feed item
            existing_feed = (
                db.query(FeedItem)
                .filter(
                    FeedItem.series_id == event.series_id,
                    FeedItem.item_type == "race_result",
                    FeedItem.title == f"{event.name} - Race Result",
                )
                .first()
            )

            if existing_feed:
                existing_feed.summary = summary
                existing_feed.updated_at = datetime.utcnow()
            else:
                feed_item = FeedItem(
                    series_id=event.series_id,
                    item_type="race_result",
                    title=f"{event.name} - Race Result",
                    summary=summary,
                    published_at=datetime.utcnow(),
                )
                db.add(feed_item)

            db.commit()
            logger.info("Race result summary created for %s", event.name)
            return summary

        except Exception:
            db.rollback()
            logger.exception("Error generating race result summary for session %d", session_id)
            return None
        finally:
            db.close()

    def generate_upcoming_previews(self) -> int:
        """Generate preview feed items for events starting within the next 7 days.

        Returns:
            The number of preview items created.
        """
        logger.info("Generating upcoming event previews...")
        db = SessionLocal()
        count = 0
        try:
            now = datetime.utcnow().date()
            upcoming_cutoff = now + timedelta(days=7)

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
                title = f"Race Preview: {event.name}"
                existing = (
                    db.query(FeedItem)
                    .filter(
                        FeedItem.series_id == event.series_id,
                        FeedItem.item_type == "preview",
                        FeedItem.title == title,
                    )
                    .first()
                )

                if existing:
                    continue

                summary = (
                    f"The {event.name} is coming up on {event.start_date}. "
                    f"Don't miss the action!"
                )
                feed_item = FeedItem(
                    series_id=event.series_id,
                    item_type="preview",
                    title=title,
                    summary=summary,
                    published_at=datetime.utcnow(),
                )
                db.add(feed_item)
                count += 1

            db.commit()
            logger.info("Created %d upcoming preview feed items.", count)
            return count

        except Exception:
            db.rollback()
            logger.exception("Error generating upcoming previews")
            return 0
        finally:
            db.close()

    def generate_highlight_item(
        self, title: str, video_url: str, series_slug: str
    ) -> Optional[int]:
        """Create a feed item of type 'highlight'.

        Args:
            title: The highlight title.
            video_url: URL to the highlight video.
            series_slug: Slug of the series (e.g., 'f1', 'wec').

        Returns:
            The ID of the created feed item, or None on failure.
        """
        logger.info("Creating highlight feed item: %s", title)
        db = SessionLocal()
        try:
            series = db.query(Series).filter(Series.slug == series_slug).first()
            if not series:
                logger.error("Series not found: %s", series_slug)
                return None

            feed_item = FeedItem(
                series_id=series.id,
                item_type="highlight",
                title=title,
                video_url=video_url,
                published_at=datetime.utcnow(),
            )
            db.add(feed_item)
            db.commit()
            logger.info("Highlight feed item created: %s (id=%d)", title, feed_item.id)
            return feed_item.id

        except Exception:
            db.rollback()
            logger.exception("Error creating highlight feed item: %s", title)
            return None
        finally:
            db.close()


def build_result_summary(
    event_name: str, winner: str, second: str, third: str
) -> str:
    """Build a race result summary string.

    This is a pure function extracted for easy testing.

    Args:
        event_name: Name of the event.
        winner: Full name of the race winner.
        second: Full name of the P2 finisher.
        third: Full name of the P3 finisher.

    Returns:
        A formatted summary string.
    """
    return f"{winner} wins the {event_name}! {second} finishes P2, {third} P3."
