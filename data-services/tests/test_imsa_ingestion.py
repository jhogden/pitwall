import unittest

from ingestion.imsa_ingestion import (
    _extract_imsa_lap_telemetry_from_json,
    _extract_imsa_result_rows_from_csv,
    _extract_imsa_result_rows_from_json,
    _parse_event_name_from_dir,
)


class TestImsaParsing(unittest.TestCase):
    def test_parse_event_name_from_dir(self):
        self.assertEqual(
            _parse_event_name_from_dir("02_Daytona%20International%20Speedway/"),
            "Daytona International Speedway",
        )

    def test_extract_imsa_result_rows_from_json(self):
        payload = {
            "classification": [
                {
                    "position": 1,
                    "number": "7",
                    "elapsed_time": "24:00:38.019",
                    "gap_first": "-",
                    "laps": "781",
                    "team": "Porsche Penske Motorsport",
                    "status": "Classified",
                    "drivers": [
                        {"firstname": "Felipe", "surname": "Nasr"},
                        {"firstname": "Nick", "surname": "Tandy"},
                    ],
                },
                {
                    "position": 2,
                    "number": "60",
                    "elapsed_time": "24:01:00.500",
                    "gap_first": "22.481",
                    "laps": "781",
                    "team": "Meyer Shank Racing",
                    "status": "Classified",
                    "drivers": [{"firstname": "Tom", "surname": "Blomqvist"}],
                },
            ]
        }

        rows = _extract_imsa_result_rows_from_json(payload)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["position"], 1)
        self.assertEqual(rows[0]["car_number"], 7)
        self.assertEqual(rows[0]["driver_name"], "Felipe Nasr")
        self.assertEqual(rows[0]["team_name"], "Porsche Penske Motorsport")
        self.assertEqual(rows[1]["gap"], "22.481")

    def test_extract_imsa_result_rows_from_csv(self):
        csv_content = (
            "POSITION;NUMBER;STATUS;LAPS;TOTAL_TIME;GAP_FIRST;TEAM;DRIVER1_FIRSTNAME;DRIVER1_SECONDNAME\n"
            "1;7;Classified;781;24:00:38.019;-;Porsche Penske Motorsport;Felipe;Nasr\n"
            "2;060;Classified;781;24:01:00.500;+22.481;Meyer Shank Racing;Tom;Blomqvist\n"
        )

        rows = _extract_imsa_result_rows_from_csv(csv_content)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["position"], 1)
        self.assertEqual(rows[0]["car_number"], 7)
        self.assertEqual(rows[0]["driver_name"], "Felipe Nasr")
        self.assertEqual(rows[1]["car_number"], 60)
        self.assertEqual(rows[1]["gap"], "+22.481")

    def test_extract_imsa_result_rows_from_legacy_csv(self):
        csv_content = (
            "POSITION;NUMBER;TEAM;DRIVER_1;STATUS;LAPS;TOTAL_TIME;GAP_FIRST\n"
            "1;10;Konica Minolta Cadillac DPi-V.R;Ricky Taylor;Classified;63;1:40'37.481;-\n"
        )

        rows = _extract_imsa_result_rows_from_csv(csv_content)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["car_number"], 10)
        self.assertEqual(rows[0]["driver_name"], "Ricky Taylor")
        self.assertEqual(rows[0]["team_name"], "Konica Minolta Cadillac DPi-V.R")

    def test_extract_imsa_lap_telemetry_from_json(self):
        timecards = {
            "participants": [
                {
                    "number": "007",
                    "team": "Aston Martin THOR Team",
                    "drivers": [
                        {"number": 1, "firstname": "Harry", "surname": "Tincknell"},
                    ],
                    "laps": [
                        {
                            "number": 1,
                            "driver_number": "1",
                            "time": "1:40.100",
                            "average_speed_kph": "180.0",
                            "top_speed_kph": "295.0",
                            "session_elapsed": "1:40.100",
                            "hour": "1/25/2025 1:42:36 PM",
                            "is_valid": True,
                            "crossing_pit_finish_lane": False,
                            "sector_times": [
                                {"index": 1, "time": "30.0"},
                                {"index": 2, "time": "35.0"},
                                {"index": 3, "time": "35.1"},
                            ],
                        }
                    ],
                }
            ]
        }
        lapchart = {
            "laps": [
                {
                    "lap_number": 1,
                    "positions": [
                        {"position": 5, "number": "007"},
                    ],
                }
            ]
        }

        rows = _extract_imsa_lap_telemetry_from_json(timecards, lapchart)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["car_number"], "007")
        self.assertEqual(rows[0]["driver_name"], "Harry Tincknell")
        self.assertEqual(rows[0]["position"], 5)
        self.assertEqual(rows[0]["sector1_time"], "30.0")
        self.assertEqual(rows[0]["sector3_time"], "35.1")


if __name__ == "__main__":
    unittest.main()
