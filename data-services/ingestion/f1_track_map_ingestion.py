import logging
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import requests

from ingestion.config import db_session
from ingestion.models import Circuit, Event, Season, Series

logger = logging.getLogger(__name__)

OPENF1_BASE = "https://api.openf1.org/v1"
F1_SLUG = "f1"


def _normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _meeting_aliases(meeting: dict) -> set[str]:
    aliases: set[str] = set()
    location = meeting.get("location") or ""
    short_name = meeting.get("circuit_short_name") or ""
    meeting_name = meeting.get("meeting_name") or ""

    for value in (location, short_name):
        if value:
            aliases.add(_normalize(value))

    if meeting_name:
        aliases.add(_normalize(meeting_name))
        aliases.add(_normalize(meeting_name.replace("Grand Prix", "").strip()))

    return {alias for alias in aliases if alias}


CIRCUIT_NAME_ALIASES: dict[str, list[str]] = {
    _normalize("Bahrain International Circuit"): [_normalize("Sakhir")],
    _normalize("Circuit of the Americas"): [_normalize("Austin")],
    _normalize("Circuit de Monaco"): [_normalize("Monaco"), _normalize("Monte Carlo")],
    _normalize("Circuit de Spa-Francorchamps"): [_normalize("Spa-Francorchamps")],
    _normalize("Circuit de Barcelona-Catalunya"): [_normalize("Barcelona")],
    _normalize("Autódromo Hermanos Rodríguez"): [_normalize("Mexico City")],
    _normalize("Autódromo José Carlos Pace"): [_normalize("São Paulo"), _normalize("Sao Paulo")],
    _normalize("Autodromo Nazionale di Monza"): [_normalize("Monza")],
    _normalize("Autodromo Enzo e Dino Ferrari"): [_normalize("Imola")],
    _normalize("Jeddah Corniche Circuit"): [_normalize("Jeddah")],
    _normalize("Las Vegas Strip Street Circuit"): [_normalize("Las Vegas")],
    _normalize("Marina Bay Street Circuit"): [_normalize("Marina Bay")],
    _normalize("Miami International Autodrome"): [_normalize("Miami Gardens")],
    _normalize("Circuit Gilles Villeneuve"): [_normalize("Montréal"), _normalize("Montreal")],
    _normalize("Red Bull Ring"): [_normalize("Spielberg")],
    _normalize("Yas Marina Circuit"): [_normalize("Yas Island"), _normalize("Yas Marina")],
    _normalize("Silverstone Circuit"): [_normalize("Silverstone")],
    _normalize("Suzuka Circuit"): [_normalize("Suzuka")],
    _normalize("Shanghai International Circuit"): [_normalize("Shanghai")],
}


@dataclass
class MeetingImage:
    year: int
    image_url: str


class F1TrackMapIngestion:
    def __init__(self) -> None:
        self._http = requests.Session()

    def _openf1_get(self, path: str, params: Optional[dict] = None) -> list[dict]:
        url = f"{OPENF1_BASE}{path}"
        attempt = 0
        while attempt < 4:
            attempt += 1
            resp = self._http.get(url, params=params or {}, timeout=30)
            if resp.status_code == 429 and attempt < 4:
                delay = 1.5 * attempt
                logger.warning("OpenF1 rate-limited (%s). Retrying in %.1fs...", url, delay)
                time.sleep(delay)
                continue
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []
        return []

    def _load_meeting_images(self, start_year: int, end_year: int) -> dict[str, MeetingImage]:
        image_by_alias: dict[str, MeetingImage] = {}

        for year in range(start_year, end_year + 1):
            try:
                meetings = self._openf1_get("/meetings", params={"year": year})
            except Exception:
                logger.warning("Could not fetch OpenF1 meetings for %d", year, exc_info=True)
                continue

            for meeting in meetings:
                image_url = (meeting.get("circuit_image") or "").strip()
                if not image_url:
                    continue
                for alias in _meeting_aliases(meeting):
                    previous = image_by_alias.get(alias)
                    if previous is None or year >= previous.year:
                        image_by_alias[alias] = MeetingImage(year=year, image_url=image_url)

        return image_by_alias

    def sync_track_maps(self, start_year: int = 2018, end_year: Optional[int] = None) -> None:
        if end_year is None:
            end_year = datetime.now(timezone.utc).year
        if end_year < start_year:
            logger.warning("Skipping F1 track map sync: invalid year range %d-%d", start_year, end_year)
            return

        logger.info("Syncing F1 track maps from OpenF1 for %d-%d...", start_year, end_year)
        image_by_alias = self._load_meeting_images(start_year, end_year)
        if not image_by_alias:
            logger.warning("No OpenF1 circuit images found for %d-%d", start_year, end_year)
            return

        updated = 0
        missing = 0

        with db_session() as db:
            circuits = (
                db.query(Circuit)
                .join(Event, Event.circuit_id == Circuit.id)
                .join(Season, Season.id == Event.season_id)
                .join(Series, Series.id == Season.series_id)
                .filter(Series.slug == F1_SLUG)
                .distinct(Circuit.id)
                .all()
            )

            for circuit in circuits:
                circuit_key = _normalize(circuit.name)
                aliases = [circuit_key]
                aliases.extend(CIRCUIT_NAME_ALIASES.get(circuit_key, []))

                image_url = None
                for alias in aliases:
                    match = image_by_alias.get(alias)
                    if match:
                        image_url = match.image_url
                        break

                if not image_url:
                    missing += 1
                    continue

                if circuit.track_map_url != image_url:
                    circuit.track_map_url = image_url
                    updated += 1

        logger.info("F1 track map sync complete. Updated=%d, missing=%d", updated, missing)
