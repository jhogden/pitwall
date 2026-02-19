import json
import logging
import re
import time
import unicodedata
from typing import Optional

import requests

from ingestion.config import db_session
from ingestion.models import Circuit, Event, Season, Series

logger = logging.getLogger(__name__)

MULTIVIEWER_BASE = "https://api.multiviewer.app/api/v1"
F1_SLUG = "f1"


def _normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", text.lower())


CIRCUIT_NAME_ALIASES: dict[str, list[str]] = {
    _normalize("Bahrain International Circuit"): [_normalize("Sakhir"), _normalize("Bahrain")],
    _normalize("Circuit of the Americas"): [_normalize("Austin"), _normalize("Americas")],
    _normalize("Circuit de Monaco"): [_normalize("Monaco"), _normalize("Monte Carlo"), _normalize("MonteCarlo")],
    _normalize("Circuit de Spa-Francorchamps"): [_normalize("Spa-Francorchamps"), _normalize("Spa")],
    _normalize("Circuit de Barcelona-Catalunya"): [_normalize("Barcelona"), _normalize("Catalunya")],
    _normalize("Autódromo Hermanos Rodríguez"): [_normalize("Mexico City"), _normalize("Mexico")],
    _normalize("Autódromo José Carlos Pace"): [_normalize("São Paulo"), _normalize("Sao Paulo"), _normalize("Interlagos")],
    _normalize("Autodromo Nazionale di Monza"): [_normalize("Monza")],
    _normalize("Autodromo Enzo e Dino Ferrari"): [_normalize("Imola")],
    _normalize("Jeddah Corniche Circuit"): [_normalize("Jeddah")],
    _normalize("Las Vegas Strip Street Circuit"): [_normalize("Las Vegas")],
    _normalize("Marina Bay Street Circuit"): [_normalize("Marina Bay"), _normalize("Singapore")],
    _normalize("Miami International Autodrome"): [_normalize("Miami Gardens"), _normalize("Miami")],
    _normalize("Circuit Gilles Villeneuve"): [_normalize("Montréal"), _normalize("Montreal")],
    _normalize("Red Bull Ring"): [_normalize("Spielberg"), _normalize("Austria")],
    _normalize("Yas Marina Circuit"): [_normalize("Yas Island"), _normalize("Yas Marina"), _normalize("Abu Dhabi")],
    _normalize("Silverstone Circuit"): [_normalize("Silverstone")],
    _normalize("Suzuka Circuit"): [_normalize("Suzuka")],
    _normalize("Shanghai International Circuit"): [_normalize("Shanghai")],
    _normalize("Hungaroring"): [_normalize("Budapest"), _normalize("Mogyorod")],
    _normalize("Circuit Zandvoort"): [_normalize("Zandvoort")],
    _normalize("Albert Park Circuit"): [_normalize("Albert Park"), _normalize("Melbourne")],
    _normalize("Losail International Circuit"): [_normalize("Lusail"), _normalize("Losail")],
    _normalize("Baku City Circuit"): [_normalize("Baku")],
}


class TrackGeometryIngestion:
    def __init__(self) -> None:
        self._http = requests.Session()
        self._http.headers["User-Agent"] = "pitwall-data-services/1.0"

    def _mv_get(self, url: str) -> dict | list:
        attempt = 0
        while attempt < 4:
            attempt += 1
            resp = self._http.get(url, timeout=30)
            if resp.status_code == 429 and attempt < 4:
                delay = 2.0 * attempt
                logger.warning("Multiviewer rate-limited (%s). Retrying in %.1fs...", url, delay)
                time.sleep(delay)
                continue
            resp.raise_for_status()
            return resp.json()
        return {}

    def _fetch_circuits(self) -> list[dict]:
        url = f"{MULTIVIEWER_BASE}/circuits"
        data = self._mv_get(url)
        if isinstance(data, dict):
            return list(data.values())
        return data if isinstance(data, list) else []

    def _fetch_geometry(self, circuit_key: int, year: int) -> Optional[dict]:
        url = f"{MULTIVIEWER_BASE}/circuits/{circuit_key}/{year}"
        try:
            data = self._mv_get(url)
            if isinstance(data, dict) and "x" in data and "y" in data:
                return data
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                return None
            raise
        return None

    def sync_track_geometry(self, year: int) -> None:
        logger.info("Syncing track geometry from Multiviewer API for year %d...", year)

        mv_circuits = self._fetch_circuits()
        if not mv_circuits:
            logger.warning("No circuits returned from Multiviewer API")
            return

        geometry_by_alias: dict[str, dict] = {}
        for mv_circuit in mv_circuits:
            circuit_key = mv_circuit.get("circuitKey")
            circuit_name = mv_circuit.get("name") or mv_circuit.get("shortName") or mv_circuit.get("circuitName") or ""
            if not circuit_key:
                continue

            geom = self._fetch_geometry(circuit_key, year)
            if geom is None:
                geom = self._fetch_geometry(circuit_key, year - 1)
            if geom is None:
                continue

            blob = {
                "x": geom["x"],
                "y": geom["y"],
                "rotation": geom.get("rotation", 0),
            }

            alias = _normalize(circuit_name)
            if alias:
                geometry_by_alias[alias] = blob
            time.sleep(0.3)

        if not geometry_by_alias:
            logger.warning("No track geometry data retrieved from Multiviewer")
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
                if circuit.city:
                    aliases.append(_normalize(circuit.city))
                aliases.extend(CIRCUIT_NAME_ALIASES.get(circuit_key, []))

                blob = None
                for alias in aliases:
                    if alias in geometry_by_alias:
                        blob = geometry_by_alias[alias]
                        break

                if blob is None:
                    missing += 1
                    logger.debug("No geometry match for circuit: %s", circuit.name)
                    continue

                blob_json = json.dumps(blob, separators=(",", ":"))
                if circuit.track_geometry != blob_json:
                    circuit.track_geometry = blob_json
                    updated += 1

        logger.info("Track geometry sync complete. Updated=%d, missing=%d", updated, missing)
