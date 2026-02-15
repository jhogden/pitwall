import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from sqlalchemy.orm import Session as DbSession
from requests import HTTPError

from ingestion.config import db_session
from ingestion.models import Event, FeedItem, Season, Series

logger = logging.getLogger(__name__)

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"

SERIES_QUERIES: dict[str, list[str]] = {
    "f1": [
        "Formula 1 highlights",
        "F1 race highlights",
    ],
    "wec": [
        "WEC highlights",
        "FIA WEC highlights",
        "World Endurance Championship highlights",
    ],
    "imsa": [
        "IMSA WeatherTech highlights",
        "IMSA race highlights",
        "IMSA Michelin Pilot Challenge highlights",
    ],
}

SERIES_KEYWORDS: dict[str, list[str]] = {
    "f1": ["formula 1", "f1", "grand prix"],
    "wec": ["wec", "world endurance", "fia wec", "hypercar", "lmgt3", "le mans"],
    "imsa": ["imsa", "weathertech", "gtp", "gtd", "michelin pilot challenge", "sebring", "daytona"],
}

# YouTube Data API quota: search.list ~100 units per request.
DEFAULT_MAX_SEARCH_REQUESTS = 9
DEFAULT_MAX_SEARCH_REQUESTS_PER_SERIES = 3


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _parse_published_at(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)


def _video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def _thumbnail_from_snippet(snippet: dict) -> Optional[str]:
    thumbs = snippet.get("thumbnails") or {}
    for key in ("maxres", "standard", "high", "medium", "default"):
        node = thumbs.get(key)
        if isinstance(node, dict) and node.get("url"):
            return str(node["url"])
    return None


def _matches_series(item: dict, series_slug: str) -> bool:
    snippet = item.get("snippet") or {}
    title = _normalize_text(str(snippet.get("title", "")))
    channel = _normalize_text(str(snippet.get("channelTitle", "")))
    combined = f"{title} {channel}".strip()
    if not combined:
        return False
    keywords = SERIES_KEYWORDS.get(series_slug) or []
    return any(keyword in combined for keyword in keywords)


def _fetch_search(
    api_key: str,
    query: str,
    published_after: datetime,
    max_results: int,
    order: str = "viewCount",
) -> list[dict]:
    params = {
        "key": api_key,
        "part": "snippet",
        "type": "video",
        "q": query,
        "order": order,
        "publishedAfter": published_after.isoformat().replace("+00:00", "Z"),
        "maxResults": max_results,
    }
    response = requests.get(YOUTUBE_SEARCH_URL, params=params, timeout=30)
    response.raise_for_status()
    payload = response.json()
    return payload.get("items") or []


def _fetch_view_counts(api_key: str, video_ids: list[str]) -> dict[str, int]:
    if not video_ids:
        return {}
    params = {
        "key": api_key,
        "part": "statistics",
        "id": ",".join(video_ids),
        "maxResults": min(len(video_ids), 50),
    }
    response = requests.get(YOUTUBE_VIDEOS_URL, params=params, timeout=30)
    response.raise_for_status()
    payload = response.json()
    counts: dict[str, int] = {}
    for item in payload.get("items") or []:
        video_id = str(item.get("id", "")).strip()
        stats = item.get("statistics") or {}
        view_count = int(stats.get("viewCount", "0")) if str(stats.get("viewCount", "0")).isdigit() else 0
        if video_id:
            counts[video_id] = view_count
    return counts


def _is_quota_exceeded(exc: Exception) -> bool:
    if not isinstance(exc, HTTPError):
        return False
    response = exc.response
    if response is None:
        return False
    if response.status_code != 403:
        return False
    try:
        payload = response.json()
    except Exception:
        return False
    errors = (payload.get("error") or {}).get("errors") or []
    return any(str(err.get("reason", "")) == "quotaExceeded" for err in errors)


def _resolve_series(db: DbSession, slug: str) -> Optional[Series]:
    return db.query(Series).filter(Series.slug == slug).first()


def _resolve_event_from_title(db: DbSession, series: Series, published_at: datetime, title: str) -> Optional[Event]:
    normalized_title = _normalize_text(title)
    if not normalized_title:
        return None

    candidate_years = {published_at.year, published_at.year - 1, published_at.year + 1}
    events = (
        db.query(Event)
        .join(Event.season)
        .filter(
            Season.series_id == series.id,
            Season.year.in_(candidate_years),
        )
        .all()
    )

    best_event: Optional[Event] = None
    best_score = 0
    for event in events:
        event_tokens = [t for t in _normalize_text(event.name).split(" ") if len(t) > 2]
        if not event_tokens:
            continue
        score = sum(1 for token in event_tokens if token in normalized_title)
        if score > best_score:
            best_event = event
            best_score = score

    return best_event if best_score >= 2 else None


class YoutubeHighlightsIngestion:
    def __init__(self) -> None:
        self.api_key = os.getenv("YOUTUBE_API_KEY", "").strip()

    def sync_recent_highlights(
        self,
        days: int = 7,
        max_per_series: int = 5,
        max_search_requests: int = DEFAULT_MAX_SEARCH_REQUESTS,
        max_search_requests_per_series: int = DEFAULT_MAX_SEARCH_REQUESTS_PER_SERIES,
    ) -> int:
        """Sync popular recent YouTube highlights into feed_items."""
        if not self.api_key:
            logger.warning("YOUTUBE_API_KEY not set; skipping YouTube highlights sync")
            return 0

        inserted_or_updated = 0
        seen_video_ids: set[str] = set()
        total_search_requests = 0
        quota_exhausted = False

        with db_session() as db:
            for series_slug, queries in SERIES_QUERIES.items():
                if quota_exhausted or total_search_requests >= max_search_requests:
                    break

                series = _resolve_series(db, series_slug)
                if not series:
                    logger.warning("Series not found for YouTube highlights: %s", series_slug)
                    continue

                # Load existing URLs for this series to avoid re-saving duplicates.
                existing_urls = {
                    row[0]
                    for row in db.query(FeedItem.content_url)
                    .filter(FeedItem.type == "highlight", FeedItem.series_id == series.id)
                    .all()
                }

                # Start strict, then widen only if needed and budget allows.
                raw_items: list[dict] = []
                seen_local_ids: set[str] = set()
                series_search_requests = 0
                search_plan: list[tuple[int, str, bool]] = [
                    (max(days, 1), "viewCount", False),
                    (max(days * 2, 14), "viewCount", False),
                    (max(days * 4, 30), "viewCount", False),
                    # Fallback pass is expensive/noisy; only run if still short.
                    (max(days * 4, 30), "relevance", True),
                ]

                for window_days, order, primary_query_only in search_plan:
                    if len(raw_items) >= (max_per_series * 2):
                        break
                    if total_search_requests >= max_search_requests:
                        break
                    if series_search_requests >= max_search_requests_per_series:
                        break

                    published_after = datetime.now(timezone.utc) - timedelta(days=window_days)
                    selected_queries = queries[:1] if primary_query_only else queries
                    for query in selected_queries:
                        if len(raw_items) >= (max_per_series * 2):
                            break
                        if total_search_requests >= max_search_requests:
                            break
                        if series_search_requests >= max_search_requests_per_series:
                            break
                        try:
                            items = _fetch_search(
                                self.api_key,
                                query,
                                published_after,
                                max_per_series,
                                order=order,
                            )
                            total_search_requests += 1
                            series_search_requests += 1
                        except Exception as exc:
                            total_search_requests += 1
                            series_search_requests += 1
                            if _is_quota_exceeded(exc):
                                logger.warning("YouTube quota exceeded; stopping highlights sync early.")
                                quota_exhausted = True
                                break
                            logger.exception(
                                "Failed YouTube search for %s (query=%s, order=%s, days=%d)",
                                series_slug,
                                query,
                                order,
                                window_days,
                            )
                            continue
                        for item in items:
                            video_id = str((item.get("id") or {}).get("videoId", "")).strip()
                            if not video_id or video_id in seen_local_ids:
                                continue
                            if not _matches_series(item, series_slug):
                                continue
                            if _video_url(video_id) in existing_urls:
                                continue
                            raw_items.append(item)
                            seen_local_ids.add(video_id)
                            if len(raw_items) >= (max_per_series * 2):
                                break
                    if quota_exhausted:
                        break

                candidates: list[dict] = []
                for item in raw_items:
                    video_id = str((item.get("id") or {}).get("videoId", "")).strip()
                    snippet = item.get("snippet") or {}
                    title = str(snippet.get("title", "")).strip()
                    if not video_id or not title or video_id in seen_video_ids:
                        continue
                    candidates.append(item)

                if not candidates:
                    continue

                ids = [str((item.get("id") or {}).get("videoId", "")) for item in candidates]
                try:
                    view_counts = _fetch_view_counts(self.api_key, ids)
                except Exception:
                    logger.exception("Failed YouTube stats fetch for %s", series_slug)
                    view_counts = {}

                ranked = sorted(
                    candidates,
                    key=lambda item: view_counts.get(str((item.get("id") or {}).get("videoId", "")), 0),
                    reverse=True,
                )[:max_per_series]

                for item in ranked:
                    video_id = str((item.get("id") or {}).get("videoId", "")).strip()
                    snippet = item.get("snippet") or {}
                    title = str(snippet.get("title", "")).strip()
                    if not video_id or not title:
                        continue

                    seen_video_ids.add(video_id)
                    content_url = _video_url(video_id)
                    published_raw = str(snippet.get("publishedAt", ""))
                    published_at = _parse_published_at(published_raw) if published_raw else datetime.now(timezone.utc)
                    channel_title = str(snippet.get("channelTitle", "")).strip()
                    views = view_counts.get(video_id, 0)
                    summary = f"{channel_title} · {views:,} views" if channel_title else f"{views:,} views"
                    thumbnail_url = _thumbnail_from_snippet(snippet)
                    event = _resolve_event_from_title(db, series, published_at, title)

                    feed_item = (
                        db.query(FeedItem)
                        .filter(FeedItem.type == "highlight", FeedItem.content_url == content_url)
                        .first()
                    )
                    if feed_item:
                        feed_item.series_id = series.id
                        feed_item.event_id = event.id if event else None
                        feed_item.title = title
                        feed_item.summary = summary
                        feed_item.thumbnail_url = thumbnail_url
                        feed_item.published_at = published_at
                    else:
                        db.add(
                            FeedItem(
                                type="highlight",
                                series_id=series.id,
                                event_id=event.id if event else None,
                                title=title,
                                summary=summary,
                                content_url=content_url,
                                thumbnail_url=thumbnail_url,
                                published_at=published_at,
                            )
                        )
                    inserted_or_updated += 1

        logger.info(
            "YouTube highlights sync complete (%d upserts, %d search requests).",
            inserted_or_updated,
            total_search_requests,
        )
        return inserted_or_updated
