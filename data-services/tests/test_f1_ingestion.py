import unittest
from unittest.mock import patch, MagicMock, PropertyMock
from contextlib import contextmanager

import pandas as pd
import numpy as np

from ingestion.f1_ingestion import (
    slugify,
    _derive_positions_from_laps,
    _fetch_jolpica_results,
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


class TestFetchJolpicaResults(unittest.TestCase):
    """Tests for fetching race results from the Jolpica API."""

    @patch("ingestion.f1_ingestion.requests.get")
    def test_returns_results_for_valid_race(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "MRData": {
                "RaceTable": {
                    "Races": [{
                        "Results": [
                            {
                                "position": "1",
                                "Driver": {"givenName": "Lando", "familyName": "Norris", "permanentNumber": "4"},
                                "Constructor": {"name": "McLaren"},
                                "laps": "57",
                                "status": "Finished",
                                "Time": {"time": "1:42:06.304"},
                            },
                            {
                                "position": "2",
                                "Driver": {"givenName": "Max", "familyName": "Verstappen", "permanentNumber": "1"},
                                "Constructor": {"name": "Red Bull"},
                                "laps": "57",
                                "status": "Finished",
                                "Time": {"time": "+0.895"},
                            },
                        ]
                    }]
                }
            }
        }

        results = _fetch_jolpica_results(2025, 1)

        self.assertIsNotNone(results)
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["Driver"]["familyName"], "Norris")
        self.assertEqual(results[1]["position"], "2")

    @patch("ingestion.f1_ingestion.requests.get")
    def test_returns_none_for_empty_races(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "MRData": {"RaceTable": {"Races": []}}
        }

        results = _fetch_jolpica_results(2025, 99)
        self.assertIsNone(results)

    @patch("ingestion.f1_ingestion.requests.get")
    def test_returns_none_on_http_error(self, mock_get):
        mock_get.return_value.raise_for_status.side_effect = Exception("404")

        results = _fetch_jolpica_results(2025, 1)
        self.assertIsNone(results)

    @patch("ingestion.f1_ingestion.requests.get")
    def test_calls_correct_url(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "MRData": {"RaceTable": {"Races": []}}
        }

        _fetch_jolpica_results(2025, 3)
        mock_get.assert_called_once_with(
            "https://api.jolpi.ca/ergast/f1/2025/3/results.json", timeout=30
        )


class TestCreateResultsFromJolpica(unittest.TestCase):
    """Tests for creating Result records from Jolpica API data."""

    def _make_jolpica_entry(self, position, first, last, number, team,
                            laps="57", status="Finished", gap=None):
        entry = {
            "position": str(position),
            "Driver": {
                "givenName": first,
                "familyName": last,
                "permanentNumber": str(number),
            },
            "Constructor": {"name": team},
            "laps": laps,
            "status": status,
        }
        if gap is not None:
            entry["Time"] = {"time": gap}
        return entry

    @patch("ingestion.f1_ingestion._find_or_create_driver")
    @patch("ingestion.f1_ingestion._find_or_create_team")
    def test_creates_results_with_correct_positions(self, mock_team, mock_driver):
        mock_team.return_value = MagicMock(id=1)
        mock_driver.return_value = MagicMock(id=10)
        mock_db = MagicMock()
        mock_series = MagicMock(id=1)
        mock_session = MagicMock(id=100)

        entries = [
            self._make_jolpica_entry(1, "Lando", "Norris", 4, "McLaren", gap="1:42:06.304"),
            self._make_jolpica_entry(2, "Max", "Verstappen", 1, "Red Bull", gap="+0.895"),
            self._make_jolpica_entry(20, "Jack", "Doohan", 7, "Alpine", laps="0", status="Retired"),
        ]

        ingestion = F1Ingestion()
        ingestion._create_results_from_jolpica(mock_db, mock_series, entries, mock_session)

        self.assertEqual(mock_db.add.call_count, 3)

        # Verify the Result objects passed to db.add
        added_results = [call.args[0] for call in mock_db.add.call_args_list]
        self.assertEqual(added_results[0].position, 1)
        self.assertEqual(added_results[0].gap, "1:42:06.304")
        self.assertEqual(added_results[0].status, "Finished")
        self.assertEqual(added_results[1].position, 2)
        self.assertEqual(added_results[1].gap, "+0.895")
        self.assertEqual(added_results[2].position, 20)
        self.assertEqual(added_results[2].status, "Retired")
        self.assertIsNone(added_results[2].gap)

    @patch("ingestion.f1_ingestion._find_or_create_driver")
    @patch("ingestion.f1_ingestion._find_or_create_team")
    def test_retired_driver_has_no_gap(self, mock_team, mock_driver):
        mock_team.return_value = MagicMock(id=1)
        mock_driver.return_value = MagicMock(id=10)
        mock_db = MagicMock()

        entries = [
            self._make_jolpica_entry(18, "Carlos", "Sainz", 55, "Williams",
                                     laps="30", status="Retired"),
        ]

        ingestion = F1Ingestion()
        ingestion._create_results_from_jolpica(mock_db, MagicMock(id=1), entries, MagicMock(id=1))

        result = mock_db.add.call_args.args[0]
        self.assertIsNone(result.gap)
        self.assertEqual(result.status, "Retired")

    @patch("ingestion.f1_ingestion._find_or_create_driver")
    @patch("ingestion.f1_ingestion._find_or_create_team")
    def test_laps_field_populated(self, mock_team, mock_driver):
        mock_team.return_value = MagicMock(id=1)
        mock_driver.return_value = MagicMock(id=10)
        mock_db = MagicMock()

        entries = [
            self._make_jolpica_entry(1, "Lando", "Norris", 4, "McLaren",
                                     laps="57", gap="1:42:06.304"),
        ]

        ingestion = F1Ingestion()
        ingestion._create_results_from_jolpica(mock_db, MagicMock(id=1), entries, MagicMock(id=1))

        result = mock_db.add.call_args.args[0]
        self.assertEqual(result.laps, 57)


if __name__ == "__main__":
    unittest.main()
