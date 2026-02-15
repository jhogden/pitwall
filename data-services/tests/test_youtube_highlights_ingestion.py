import unittest
from contextlib import contextmanager
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from requests import HTTPError

from ingestion.youtube_highlights_ingestion import (
    YoutubeHighlightsIngestion,
    _matches_series,
)


def _make_mock_db_session(mock_db):
    @contextmanager
    def fake_db_session():
        yield mock_db
    return fake_db_session


class TestYoutubeSeriesMatching(unittest.TestCase):
    def test_matches_wec_keywords(self):
        item = {"snippet": {"title": "WEC Qatar 1812KM Highlights", "channelTitle": "FIAWEC"}}
        self.assertTrue(_matches_series(item, "wec"))

    def test_rejects_unrelated_for_imsa(self):
        item = {"snippet": {"title": "ICC T20 World Cup Highlights", "channelTitle": "ICC"}}
        self.assertFalse(_matches_series(item, "imsa"))


class TestYoutubeHighlightsIngestion(unittest.TestCase):
    def test_returns_zero_when_api_key_missing(self):
        with patch.dict("os.environ", {}, clear=True):
            svc = YoutubeHighlightsIngestion()
            self.assertEqual(svc.sync_recent_highlights(), 0)

    @patch("ingestion.youtube_highlights_ingestion.db_session")
    @patch("ingestion.youtube_highlights_ingestion._resolve_series")
    @patch("ingestion.youtube_highlights_ingestion._fetch_search")
    def test_stops_early_on_quota_exceeded(self, mock_fetch_search, mock_resolve_series, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)
        mock_resolve_series.return_value = MagicMock(id=1)

        resp = MagicMock()
        resp.status_code = 403
        resp.json.return_value = {"error": {"errors": [{"reason": "quotaExceeded"}]}}
        mock_fetch_search.side_effect = HTTPError(response=resp)

        with patch.dict("os.environ", {"YOUTUBE_API_KEY": "test-key"}):
            svc = YoutubeHighlightsIngestion()
            result = svc.sync_recent_highlights(max_search_requests=5, max_search_requests_per_series=2)

        self.assertEqual(result, 0)
        self.assertEqual(mock_fetch_search.call_count, 1)

    @patch("ingestion.youtube_highlights_ingestion.db_session")
    @patch("ingestion.youtube_highlights_ingestion._resolve_event_from_title")
    @patch("ingestion.youtube_highlights_ingestion._fetch_view_counts")
    @patch("ingestion.youtube_highlights_ingestion._fetch_search")
    @patch("ingestion.youtube_highlights_ingestion._resolve_series")
    def test_adds_new_highlight_item(
        self,
        mock_resolve_series,
        mock_fetch_search,
        mock_fetch_view_counts,
        mock_resolve_event,
        mock_db_session_fn,
    ):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)
        mock_resolve_series.return_value = MagicMock(id=1)
        mock_resolve_event.return_value = None

        mock_fetch_search.return_value = [
            {
                "id": {"videoId": "abc123"},
                "snippet": {
                    "title": "Formula 1 Bahrain Highlights",
                    "channelTitle": "FORMULA 1",
                    "publishedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "thumbnails": {"high": {"url": "https://img.example/abc123.jpg"}},
                },
            }
        ]
        mock_fetch_view_counts.return_value = {"abc123": 1000}

        existing_urls_query = MagicMock()
        existing_urls_query.filter.return_value.all.return_value = []
        feed_query = MagicMock()
        feed_query.filter.return_value.first.return_value = None

        def query_side_effect(model):
            if getattr(model, "__name__", "") == "FeedItem":
                return feed_query
            if getattr(model, "key", "") == "content_url":
                return existing_urls_query
            return MagicMock()

        mock_db.query.side_effect = query_side_effect

        with patch("ingestion.youtube_highlights_ingestion.SERIES_QUERIES", {"f1": ["Formula 1 highlights"]}):
            with patch.dict("os.environ", {"YOUTUBE_API_KEY": "test-key"}):
                svc = YoutubeHighlightsIngestion()
                result = svc.sync_recent_highlights(max_per_series=1, max_search_requests=1, max_search_requests_per_series=1)

        self.assertEqual(result, 1)
        mock_db.add.assert_called_once()
        added = mock_db.add.call_args[0][0]
        self.assertEqual(added.type, "highlight")
        self.assertEqual(added.content_url, "https://www.youtube.com/watch?v=abc123")

    @patch("ingestion.youtube_highlights_ingestion.db_session")
    @patch("ingestion.youtube_highlights_ingestion._resolve_event_from_title")
    @patch("ingestion.youtube_highlights_ingestion._fetch_view_counts")
    @patch("ingestion.youtube_highlights_ingestion._fetch_search")
    @patch("ingestion.youtube_highlights_ingestion._resolve_series")
    def test_updates_existing_highlight_item(
        self,
        mock_resolve_series,
        mock_fetch_search,
        mock_fetch_view_counts,
        mock_resolve_event,
        mock_db_session_fn,
    ):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)
        series = MagicMock(id=1)
        mock_resolve_series.return_value = series
        mock_resolve_event.return_value = None

        mock_fetch_search.return_value = [
            {
                "id": {"videoId": "abc123"},
                "snippet": {
                    "title": "Formula 1 Bahrain Highlights",
                    "channelTitle": "FORMULA 1",
                    "publishedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "thumbnails": {"high": {"url": "https://img.example/abc123.jpg"}},
                },
            }
        ]
        mock_fetch_view_counts.return_value = {"abc123": 2000}

        existing_urls_query = MagicMock()
        existing_urls_query.filter.return_value.all.return_value = [("https://www.youtube.com/watch?v=old",)]
        existing_feed = MagicMock()
        feed_query = MagicMock()
        feed_query.filter.return_value.first.return_value = existing_feed

        def query_side_effect(model):
            if getattr(model, "__name__", "") == "FeedItem":
                return feed_query
            if getattr(model, "key", "") == "content_url":
                return existing_urls_query
            return MagicMock()

        mock_db.query.side_effect = query_side_effect

        with patch("ingestion.youtube_highlights_ingestion.SERIES_QUERIES", {"f1": ["Formula 1 highlights"]}):
            with patch.dict("os.environ", {"YOUTUBE_API_KEY": "test-key"}):
                svc = YoutubeHighlightsIngestion()
                result = svc.sync_recent_highlights(max_per_series=1, max_search_requests=1, max_search_requests_per_series=1)

        self.assertEqual(result, 1)
        self.assertEqual(existing_feed.title, "Formula 1 Bahrain Highlights")
        self.assertEqual(existing_feed.series_id, series.id)
        mock_db.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
