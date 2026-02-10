import unittest
from unittest.mock import patch, MagicMock

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


class TestFeedGeneratorGenerateRaceResultSummary(unittest.TestCase):
    """Tests for FeedGenerator.generate_race_result_summary with mocked DB."""

    @patch("ingestion.feed_generator.SessionLocal")
    def test_returns_none_when_session_not_found(self, mock_session_local):
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        mock_db.query.return_value.filter.return_value.first.return_value = None

        generator = FeedGenerator()
        result = generator.generate_race_result_summary(999)

        self.assertIsNone(result)
        mock_db.close.assert_called_once()

    @patch("ingestion.feed_generator.SessionLocal")
    def test_returns_summary_with_valid_results(self, mock_session_local):
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db

        # Mock session
        mock_session = MagicMock()
        mock_session.id = 1
        mock_session.event_id = 10

        # Mock event
        mock_event = MagicMock()
        mock_event.id = 10
        mock_event.name = "British Grand Prix"
        mock_event.series_id = 1

        # Mock results
        mock_result_1 = MagicMock()
        mock_result_1.driver_id = 100
        mock_result_1.position = 1

        mock_result_2 = MagicMock()
        mock_result_2.driver_id = 101
        mock_result_2.position = 2

        mock_result_3 = MagicMock()
        mock_result_3.driver_id = 102
        mock_result_3.position = 3

        # Mock drivers
        mock_driver_1 = MagicMock()
        mock_driver_1.first_name = "Lewis"
        mock_driver_1.last_name = "Hamilton"

        mock_driver_2 = MagicMock()
        mock_driver_2.first_name = "Max"
        mock_driver_2.last_name = "Verstappen"

        mock_driver_3 = MagicMock()
        mock_driver_3.first_name = "Lando"
        mock_driver_3.last_name = "Norris"

        # Configure the mock query chain
        def query_side_effect(model):
            mock_q = MagicMock()
            if model.__name__ == "Session":
                mock_q.filter.return_value.first.return_value = mock_session
            elif model.__name__ == "Event":
                mock_q.filter.return_value.first.return_value = mock_event
            elif model.__name__ == "Result":
                mock_q.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
                    mock_result_1,
                    mock_result_2,
                    mock_result_3,
                ]
            elif model.__name__ == "Driver":
                driver_map = {
                    100: mock_driver_1,
                    101: mock_driver_2,
                    102: mock_driver_3,
                }
                # Return the appropriate driver based on the filter call
                def filter_side_effect(*args, **kwargs):
                    result_mock = MagicMock()
                    # We need to figure out which driver_id was requested
                    # This is simplified - in practice we check the filter args
                    return result_mock

                mock_q.filter.side_effect = filter_side_effect
            elif model.__name__ == "FeedItem":
                mock_q.filter.return_value.first.return_value = None
            return mock_q

        mock_db.query.side_effect = query_side_effect

        # For the driver lookups, we need a different approach since they're
        # called sequentially. We'll use a counter.
        driver_call_count = {"count": 0}
        driver_sequence = [mock_driver_1, mock_driver_2, mock_driver_3]
        original_side_effect = mock_db.query.side_effect

        def enhanced_query_side_effect(model):
            mock_q = original_side_effect(model)
            if hasattr(model, "__name__") and model.__name__ == "Driver":
                idx = min(driver_call_count["count"], 2)
                mock_q.filter.return_value.first.return_value = driver_sequence[idx]
                driver_call_count["count"] += 1
            return mock_q

        mock_db.query.side_effect = enhanced_query_side_effect

        generator = FeedGenerator()
        result = generator.generate_race_result_summary(1)

        self.assertIsNotNone(result)
        self.assertIn("Lewis Hamilton wins the British Grand Prix!", result)
        self.assertIn("Max Verstappen finishes P2", result)
        self.assertIn("Lando Norris P3.", result)
        mock_db.commit.assert_called_once()
        mock_db.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
