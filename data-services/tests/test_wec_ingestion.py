import unittest

from ingestion.wec_ingestion import _extract_wec_race_rows, _normalize_key, _parse_wec_calendar_text


SAMPLE_WEC_TEXT = """
Races Calendar
SEASON 2025
Sport competitions
26
Feb
28
Feb
Qatar 1812Km TBA
18
Apr
20
Apr
6 Hours of Imola TBA
14
Jun
15
Jun
24 Hours of Le Mans LE MANS 24 HEURES
"""


class TestWecParsing(unittest.TestCase):

    def test_parse_wec_calendar_text(self):
        events = _parse_wec_calendar_text(2025, SAMPLE_WEC_TEXT)

        self.assertEqual(len(events), 3)
        self.assertEqual(events[0]["name"], "Qatar 1812Km")
        self.assertEqual(str(events[0]["start_date"]), "2025-02-26")
        self.assertEqual(str(events[0]["end_date"]), "2025-02-28")
        self.assertEqual(events[2]["name"], "24 Hours of Le Mans")

    def test_normalize_key_removes_accents(self):
        self.assertEqual(_normalize_key("Rolex 6 Hours of São Paulo"), "rolex 6 hours of sao paulo")

    def test_extract_wec_race_rows(self):
        html = """
        <table>
          <thead>
            <tr><th>Status</th><th>Pos</th><th>Team</th><th>Drivers</th><th>Laps</th><th>Total time</th><th>Gap first</th></tr>
          </thead>
          <tbody>
            <tr><td>Classified</td><td>1</td><td>50 FERRARI AF CORSE</td><td>A.Fuoco/Nielsen/Molina</td><td>318</td><td>6:00:00.000</td><td></td></tr>
            <tr><td>Classified</td><td>2</td><td>83 AF CORSE</td><td>R.Kubica/Ye/Shwartzman</td><td>318</td><td>6:00:08.491</td><td>8.491</td></tr>
          </tbody>
        </table>
        """
        rows = _extract_wec_race_rows(html)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["position"], 1)
        self.assertEqual(rows[0]["car_number"], 50)
        self.assertEqual(rows[0]["team_name"], "FERRARI AF CORSE")
        self.assertEqual(rows[1]["gap"], "8.491")


if __name__ == "__main__":
    unittest.main()
