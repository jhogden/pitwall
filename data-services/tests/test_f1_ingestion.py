import unittest
from unittest.mock import patch, MagicMock, PropertyMock
from contextlib import contextmanager

import pandas as pd
import numpy as np

from ingestion.f1_ingestion import (
    slugify,
    _derive_positions_from_laps,
    _find_or_create,
    _find_or_create_driver,
    F1Ingestion,
)


class TestSlugify(unittest.TestCase):
    """Tests for the slugify helper."""

    def test_basic_slugify(self):
        self.assertEqual(slugify("Australian Grand Prix"), "australian-grand-prix")

    def test_with_periods_and_apostrophes(self):
        self.assertEqual(slugify("St. Peter's GP"), "st-peters-gp")

    def test_already_lowercase(self):
        self.assertEqual(slugify("test"), "test")

    def test_year_event_slug(self):
        self.assertEqual(slugify("2025-Australian Grand Prix"), "2025-australian-grand-prix")


class TestDerivePositionsFromLaps(unittest.TestCase):
    """Tests for position derivation from lap data (post-Ergast shutdown)."""

    def test_returns_unchanged_when_positions_present(self):
        results_df = pd.DataFrame({
            "DriverNumber": ["1", "44", "4"],
            "Position": [1.0, 2.0, 3.0],
        })
        mock_session = MagicMock()

        result = _derive_positions_from_laps(mock_session, results_df)
        self.assertEqual(list(result["Position"]), [1.0, 2.0, 3.0])

    def test_derives_positions_when_all_nan(self):
        results_df = pd.DataFrame({
            "DriverNumber": ["1", "44", "4"],
            "Position": [float("nan"), float("nan"), float("nan")],
        })

        # Simulate FastF1 laps DataFrame with default integer index
        laps_df = pd.DataFrame({
            "DriverNumber": ["44", "1", "4", "44", "1", "4"],
            "LapNumber": [1, 1, 1, 2, 2, 2],
            "Position": [1.0, 2.0, 3.0, 2.0, 1.0, 3.0],
        })

        mock_session = MagicMock()
        mock_session.laps = laps_df

        result = _derive_positions_from_laps(mock_session, results_df)
        # Last lap: driver 1 -> Position 1.0, driver 44 -> Position 2.0, driver 4 -> Position 3.0
        # Sorted by position then ranked: 1->P1, 44->P2, 4->P3
        self.assertFalse(result["Position"].isna().any())
        pos_list = list(result["Position"])
        self.assertEqual(len(pos_list), 3)

    def test_returns_unchanged_when_no_laps(self):
        results_df = pd.DataFrame({
            "DriverNumber": ["1", "44"],
            "Position": [float("nan"), float("nan")],
        })

        mock_session = MagicMock()
        mock_session.laps = pd.DataFrame()

        result = _derive_positions_from_laps(mock_session, results_df)
        self.assertTrue(result["Position"].isna().all())

    def test_returns_unchanged_when_laps_is_none(self):
        results_df = pd.DataFrame({
            "DriverNumber": ["1"],
            "Position": [float("nan")],
        })

        mock_session = MagicMock()
        mock_session.laps = None

        result = _derive_positions_from_laps(mock_session, results_df)
        self.assertTrue(result["Position"].isna().all())


class TestFindOrCreate(unittest.TestCase):
    """Tests for the generic _find_or_create helper."""

    def test_returns_existing_instance(self):
        mock_db = MagicMock()
        existing = MagicMock()
        mock_db.query.return_value.filter_by.return_value.first.return_value = existing

        result = _find_or_create(mock_db, MagicMock, {"slug": "test"}, {"name": "Test"})
        self.assertEqual(result, existing)
        mock_db.add.assert_not_called()

    def test_creates_new_when_not_found(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter_by.return_value.first.return_value = None

        MockModel = MagicMock()
        result = _find_or_create(mock_db, MockModel, {"slug": "test"}, {"name": "Test"})

        MockModel.assert_called_once_with(slug="test", name="Test")
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()


class TestFindOrCreateDriver(unittest.TestCase):
    """Tests for driver find-or-create logic."""

    def test_creates_new_driver(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        driver = _find_or_create_driver(mock_db, "Max", "Verstappen", 1, 5)

        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

    def test_updates_team_id_if_changed(self):
        mock_db = MagicMock()
        existing_driver = MagicMock()
        existing_driver.team_id = 3
        mock_db.query.return_value.filter.return_value.first.return_value = existing_driver

        driver = _find_or_create_driver(mock_db, "Max", "Verstappen", 1, 5)

        self.assertEqual(driver.team_id, 5)

    def test_slug_generation(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        _find_or_create_driver(mock_db, "Charles", "Leclerc", 16, 2)

        # Verify query used correct slug
        filter_call = mock_db.query.return_value.filter.call_args
        # The slug for "Charles Leclerc" should be "charles-leclerc"


class TestResolveRoundNumber(unittest.TestCase):
    """Tests for F1Ingestion.resolve_round_number."""

    @patch("ingestion.f1_ingestion.fastf1")
    def test_resolves_correct_round(self, mock_fastf1):
        schedule = pd.DataFrame({
            "EventName": ["Australian Grand Prix", "Chinese Grand Prix", "Japanese Grand Prix"],
            "RoundNumber": [1, 2, 3],
        })
        mock_fastf1.get_event_schedule.return_value = schedule

        ingestion = F1Ingestion()
        result = ingestion.resolve_round_number(2025, "2025-australian-grand-prix")

        self.assertEqual(result, 1)

    @patch("ingestion.f1_ingestion.fastf1")
    def test_returns_none_for_unknown_slug(self, mock_fastf1):
        schedule = pd.DataFrame({
            "EventName": ["Australian Grand Prix"],
            "RoundNumber": [1],
        })
        mock_fastf1.get_event_schedule.return_value = schedule

        ingestion = F1Ingestion()
        result = ingestion.resolve_round_number(2025, "2025-nonexistent-gp")

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
