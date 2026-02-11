import unittest
from unittest.mock import patch, MagicMock
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

from ingestion.main import (
    get_event_slugs_needing_results,
    update_event_statuses,
    current_year,
    previous_year,
)


def _make_mock_db_session(mock_db):
    @contextmanager
    def fake_db_session():
        yield mock_db
    return fake_db_session


class TestCurrentAndPreviousYear(unittest.TestCase):

    def test_current_year(self):
        self.assertEqual(current_year(), datetime.now(timezone.utc).year)

    def test_previous_year(self):
        self.assertEqual(previous_year(), datetime.now(timezone.utc).year - 1)


class TestGetEventSlugsNeedingResults(unittest.TestCase):

    @patch("ingestion.main.db_session")
    def test_returns_empty_when_no_events(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)
        mock_db.query.return_value.join.return_value.filter.return_value.all.return_value = []

        result = get_event_slugs_needing_results(2025)
        self.assertEqual(result, [])

    @patch("ingestion.main.db_session")
    def test_returns_slugs_for_events_missing_results(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        mock_event = MagicMock()
        mock_event.id = 1
        mock_event.slug = "2025-australian-grand-prix"

        mock_session = MagicMock()
        mock_session.id = 10
        mock_session.type = "race"

        # Build separate mock return values for each model query
        event_query = MagicMock()
        event_query.join.return_value.filter.return_value.all.return_value = [mock_event]

        session_query = MagicMock()
        session_query.filter.return_value.all.return_value = [mock_session]

        result_query = MagicMock()
        result_query.filter.return_value.count.return_value = 0

        def query_side_effect(model):
            name = getattr(model, "__name__", "")
            if name == "Event":
                return event_query
            elif name == "Session":
                return session_query
            elif name == "Result":
                return result_query
            return MagicMock()

        mock_db.query.side_effect = query_side_effect

        result = get_event_slugs_needing_results(2025)
        self.assertIn("2025-australian-grand-prix", result)

    @patch("ingestion.main.db_session")
    def test_returns_empty_list_on_exception(self, mock_db_session_fn):
        mock_db_session_fn.side_effect = Exception("DB error")

        result = get_event_slugs_needing_results(2025)
        self.assertEqual(result, [])


class TestUpdateEventStatuses(unittest.TestCase):

    @patch("ingestion.main.db_session")
    def test_marks_past_events_as_completed(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        past_event = MagicMock()
        past_event.status = "upcoming"
        past_event.end_date = date.today() - timedelta(days=5)

        # First query returns past events, second returns active events
        call_count = {"n": 0}

        def query_side_effect(model):
            mock_q = MagicMock()
            if call_count["n"] == 0:
                # Past events query
                mock_q.filter.return_value.all.return_value = [past_event]
                call_count["n"] += 1
            else:
                # Active events query
                mock_q.filter.return_value.all.return_value = []
            return mock_q

        mock_db.query.side_effect = query_side_effect

        update_event_statuses()
        self.assertEqual(past_event.status, "completed")


if __name__ == "__main__":
    unittest.main()
