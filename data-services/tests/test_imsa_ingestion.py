import unittest

from ingestion.imsa_ingestion import _extract_imsa_result_rows_from_json, _parse_event_name_from_dir


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


if __name__ == "__main__":
    unittest.main()
