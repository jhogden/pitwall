import unittest
from unittest.mock import patch, MagicMock
from contextlib import contextmanager

from ingestion.feed_generator import FeedGenerator, build_result_summary


class TestBuildResultSummary(unittest.TestCase):
    """Tests for the build_result_summary pure function."""

    def test_basic_summary(self):
        result = build_result_summary(
            "Australian Grand Prix",
            "Max Verstappen",
            "Lewis Hamilton",
            "Lando Norris",
        )
        self.assertEqual(
            result,
            "Max Verstappen wins the Australian Grand Prix! "
            "Lewis Hamilton finishes P2, Lando Norris P3.",
        )

    def test_summary_with_special_characters(self):
        result = build_result_summary(
            "São Paulo Grand Prix",
            "Charles Leclerc",
            "Carlos Sainz",
            "Oscar Piastri",
        )
        self.assertIn("Charles Leclerc wins the São Paulo Grand Prix!", result)
        self.assertIn("Carlos Sainz finishes P2", result)
        self.assertIn("Oscar Piastri P3.", result)

    def test_summary_format(self):
        result = build_result_summary("Monaco GP", "A", "B", "C")
        self.assertTrue(result.startswith("A wins the Monaco GP!"))
        self.assertTrue(result.endswith("C P3."))


def _make_mock_db_session(mock_db):
    """Create a mock context manager that yields mock_db."""
    @contextmanager
    def fake_db_session():
        yield mock_db
    return fake_db_session


class TestFeedGeneratorGenerateRaceResultSummary(unittest.TestCase):
    """Tests for FeedGenerator.generate_race_result_summary with mocked DB."""

    @patch("ingestion.feed_generator.db_session")
    def test_returns_none_when_session_not_found(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)
        mock_db.query.return_value.filter.return_value.first.return_value = None

        generator = FeedGenerator()
        result = generator.generate_race_result_summary(999)

        self.assertIsNone(result)

    @patch("ingestion.feed_generator.db_session")
    def test_returns_none_when_event_not_found(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        mock_session = MagicMock()
        mock_session.event_id = 10

        call_count = {"n": 0}

        def query_side_effect(model):
            mock_q = MagicMock()
            if model.__name__ == "Session":
                mock_q.filter.return_value.first.return_value = mock_session
            else:
                mock_q.filter.return_value.first.return_value = None
            return mock_q

        mock_db.query.side_effect = query_side_effect

        generator = FeedGenerator()
        result = generator.generate_race_result_summary(1)
        self.assertIsNone(result)

    @patch("ingestion.feed_generator.db_session")
    def test_returns_none_when_fewer_than_3_results(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        mock_session = MagicMock()
        mock_session.event_id = 10

        mock_event = MagicMock()
        mock_event.id = 10
        mock_event.name = "Test GP"

        def query_side_effect(model):
            mock_q = MagicMock()
            if model.__name__ == "Session":
                mock_q.filter.return_value.first.return_value = mock_session
            elif model.__name__ == "Event":
                mock_q.filter.return_value.first.return_value = mock_event
            elif model.__name__ == "Result":
                mock_q.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
                    MagicMock()
                ]
            return mock_q

        mock_db.query.side_effect = query_side_effect

        generator = FeedGenerator()
        result = generator.generate_race_result_summary(1)
        self.assertIsNone(result)

    @patch("ingestion.feed_generator.db_session")
    def test_returns_summary_with_valid_results(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        mock_session = MagicMock()
        mock_session.id = 1
        mock_session.event_id = 10

        mock_event = MagicMock()
        mock_event.id = 10
        mock_event.name = "British Grand Prix"
        mock_event.season.series_id = 1

        mock_results = [
            MagicMock(driver_id=100, position=1),
            MagicMock(driver_id=101, position=2),
            MagicMock(driver_id=102, position=3),
        ]

        mock_driver_1 = MagicMock(name="Lewis Hamilton")
        mock_driver_1.name = "Lewis Hamilton"
        mock_driver_2 = MagicMock(name="Max Verstappen")
        mock_driver_2.name = "Max Verstappen"
        mock_driver_3 = MagicMock(name="Lando Norris")
        mock_driver_3.name = "Lando Norris"

        driver_sequence = [mock_driver_1, mock_driver_2, mock_driver_3]
        driver_call_idx = {"i": 0}

        def query_side_effect(model):
            mock_q = MagicMock()
            if model.__name__ == "Session":
                mock_q.filter.return_value.first.return_value = mock_session
            elif model.__name__ == "Event":
                mock_q.filter.return_value.first.return_value = mock_event
            elif model.__name__ == "Result":
                mock_q.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mock_results
            elif model.__name__ == "Driver":
                idx = min(driver_call_idx["i"], 2)
                mock_q.filter.return_value.first.return_value = driver_sequence[idx]
                driver_call_idx["i"] += 1
            elif model.__name__ == "FeedItem":
                mock_q.filter.return_value.first.return_value = None
            return mock_q

        mock_db.query.side_effect = query_side_effect

        generator = FeedGenerator()
        result = generator.generate_race_result_summary(1)

        self.assertIsNotNone(result)
        self.assertIn("Lewis Hamilton wins the British Grand Prix!", result)
        self.assertIn("Max Verstappen finishes P2", result)
        self.assertIn("Lando Norris P3.", result)

    @patch("ingestion.feed_generator.db_session")
    def test_updates_existing_feed_item(self, mock_db_session_fn):
        mock_db = MagicMock()
        mock_db_session_fn.side_effect = _make_mock_db_session(mock_db)

        mock_session = MagicMock(id=1, event_id=10)
        mock_event = MagicMock(id=10)
        mock_event.name = "Test GP"
        mock_event.season.series_id = 1

        mock_results = [
            MagicMock(driver_id=100, position=1),
            MagicMock(driver_id=101, position=2),
            MagicMock(driver_id=102, position=3),
        ]

        mock_driver = MagicMock()
        mock_driver.name = "Driver"

        existing_feed = MagicMock()

        def query_side_effect(model):
            mock_q = MagicMock()
            if model.__name__ == "Session":
                mock_q.filter.return_value.first.return_value = mock_session
            elif model.__name__ == "Event":
                mock_q.filter.return_value.first.return_value = mock_event
            elif model.__name__ == "Result":
                mock_q.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mock_results
            elif model.__name__ == "Driver":
                mock_q.filter.return_value.first.return_value = mock_driver
            elif model.__name__ == "FeedItem":
                mock_q.filter.return_value.first.return_value = existing_feed
            return mock_q

        mock_db.query.side_effect = query_side_effect

        generator = FeedGenerator()
        result = generator.generate_race_result_summary(1)

        self.assertIsNotNone(result)
        # Should update existing feed item's summary, not add a new one
        self.assertEqual(
            existing_feed.summary,
            "Driver wins the Test GP! Driver finishes P2, Driver P3.",
        )
        mock_db.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
