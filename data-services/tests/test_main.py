import unittest
from unittest.mock import patch, MagicMock
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

from ingestion.main import (
    get_event_slugs_needing_results,
    update_event_statuses,
    current_year,
    previous_year,
    run_historical_sync,
    _season_has_results,
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
        mock_db.query.return_value.join.return_value.join.return_value.filter.return_value.all.return_value = []

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
        event_query.join.return_value.join.return_value.filter.return_value.all.return_value = [mock_event]

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


class TestSeasonHasResults(unittest.TestCase):
    """Tests for _season_has_results helper."""

    @patch("ingestion.main.db_session")
    def test_returns_false_when_no_season(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)
        mock_db.query.return_value.filter.return_value.first.return_value = None

        self.assertFalse(_season_has_results(1950))

    @patch("ingestion.main.db_session")
    def test_returns_false_when_no_events(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        mock_season = MagicMock(id=1)

        call_count = {"n": 0}

        def query_side_effect(model):
            model_name = getattr(model, "__name__", "")
            mock_q = MagicMock()
            if model_name == "Season":
                mock_q.filter.return_value.first.return_value = mock_season
            elif model_name == "Event":
                mock_q.filter.return_value.all.return_value = []
            return mock_q

        mock_db.query.side_effect = query_side_effect

        self.assertFalse(_season_has_results(1950))

    @patch("ingestion.main.db_session")
    def test_returns_true_when_results_exist(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        mock_season = MagicMock(id=1)
        mock_event = MagicMock(id=5)
        mock_session = MagicMock(id=20)

        def query_side_effect(model):
            model_name = getattr(model, "__name__", "")
            mock_q = MagicMock()
            if model_name == "Season":
                mock_q.filter.return_value.first.return_value = mock_season
            elif model_name == "Event":
                mock_q.filter.return_value.all.return_value = [mock_event]
            elif model_name == "Session":
                mock_q.filter.return_value.all.return_value = [mock_session]
            elif model_name == "Result":
                mock_q.filter.return_value.count.return_value = 22
            return mock_q

        mock_db.query.side_effect = query_side_effect

        self.assertTrue(_season_has_results(1950))


class TestRunHistoricalSync(unittest.TestCase):
    """Tests for run_historical_sync."""

    @patch("ingestion.main._season_has_results")
    @patch("ingestion.main.F1Ingestion")
    def test_syncs_years_without_results(self, mock_ingestion_cls, mock_has_results):
        mock_ingestion = MagicMock()
        mock_ingestion_cls.return_value = mock_ingestion
        mock_has_results.return_value = False

        run_historical_sync(1950, 1952)

        self.assertEqual(mock_ingestion.sync_historical_season.call_count, 3)
        mock_ingestion.sync_historical_season.assert_any_call(1950)
        mock_ingestion.sync_historical_season.assert_any_call(1951)
        mock_ingestion.sync_historical_season.assert_any_call(1952)

    @patch("ingestion.main._season_has_results")
    @patch("ingestion.main.F1Ingestion")
    def test_skips_years_with_existing_results(self, mock_ingestion_cls, mock_has_results):
        mock_ingestion = MagicMock()
        mock_ingestion_cls.return_value = mock_ingestion
        mock_has_results.side_effect = lambda y: y == 1951  # Only 1951 has results

        run_historical_sync(1950, 1952)

        self.assertEqual(mock_ingestion.sync_historical_season.call_count, 2)
        mock_ingestion.sync_historical_season.assert_any_call(1950)
        mock_ingestion.sync_historical_season.assert_any_call(1952)

    @patch("ingestion.main._season_has_results")
    @patch("ingestion.main.F1Ingestion")
    def test_handles_sync_exception(self, mock_ingestion_cls, mock_has_results):
        mock_ingestion = MagicMock()
        mock_ingestion_cls.return_value = mock_ingestion
        mock_has_results.return_value = False
        mock_ingestion.sync_historical_season.side_effect = Exception("API error")

        # Should not raise
        run_historical_sync(1950, 1950)


if __name__ == "__main__":
    unittest.main()
