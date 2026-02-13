import unittest
from unittest.mock import patch, MagicMock

from ingestion.standings_ingestion import (
    _points_for_position,
    _fetch_jolpica_driver_standings,
    _fetch_jolpica_constructor_standings,
    StandingsIngestion,
)


class TestStandingsHelpers(unittest.TestCase):
    def test_points_for_position(self):
        table = [25, 18, 15]
        self.assertEqual(_points_for_position(1, table), 25)
        self.assertEqual(_points_for_position(2, table), 18)
        self.assertEqual(_points_for_position(4, table), 0)
        self.assertEqual(_points_for_position(0, table), 0)

    @patch("ingestion.standings_ingestion.requests.get")
    def test_fetch_jolpica_driver_standings(self, mock_get):
        mock_get.return_value.json.return_value = {
            "MRData": {
                "StandingsTable": {
                    "StandingsLists": [
                        {"DriverStandings": [{"position": "1", "points": "100"}]}
                    ]
                }
            }
        }
        rows = _fetch_jolpica_driver_standings(2025)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["position"], "1")

    @patch("ingestion.standings_ingestion.requests.get")
    def test_fetch_jolpica_constructor_standings(self, mock_get):
        mock_get.return_value.json.return_value = {
            "MRData": {
                "StandingsTable": {
                    "StandingsLists": [
                        {"ConstructorStandings": [{"position": "1", "points": "100"}]}
                    ]
                }
            }
        }
        rows = _fetch_jolpica_constructor_standings(2025)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["position"], "1")


class TestStandingsSyncRouting(unittest.TestCase):
    @patch.object(StandingsIngestion, "sync_derived_standings_from_results")
    @patch.object(StandingsIngestion, "sync_f1_official_standings")
    def test_sync_all_for_year_uses_fallback_when_no_f1_official(
        self, mock_f1_official, mock_derived
    ):
        mock_f1_official.return_value = False
        ingestion = StandingsIngestion()
        ingestion.sync_all_for_year(2025)

        mock_f1_official.assert_called_once_with(2025)
        mock_derived.assert_any_call("f1", 2025)
        mock_derived.assert_any_call("wec", 2025)
        mock_derived.assert_any_call("imsa", 2025)


if __name__ == "__main__":
    unittest.main()
