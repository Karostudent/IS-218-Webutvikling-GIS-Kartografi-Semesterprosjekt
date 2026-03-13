"""
Henter data for brannstasjoner, sykehus og politistasjoner i Norge fra OpenStreetMap via Overpass API.

- Brannstasjoner:            OpenStreetMap (Overpass API)
- Sykehus:                   OpenStreetMap (Overpass API)
- Politistasjoner:           OpenStreetMap (Overpass API)
  

Output:
- data/emergency_resources_police.geojson
- data/emergency_resources_hospital.geojson
- data/emergency_resources_fire.geojson
""" 

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data"
LEGACY_OUTPUT_FILE = OUTPUT_DIR / "emergency_resources.geojson"
OUTPUT_FILE_BY_TYPE = {
    "police_station": OUTPUT_DIR / "emergency_resources_police.geojson",
    "hospital": OUTPUT_DIR / "emergency_resources_hospital.geojson",
    "fire_station": OUTPUT_DIR / "emergency_resources_fire.geojson",
}

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
HOSPITAL_OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]
OVERPASS_TIMEOUT_SECONDS = 120
HOSPITAL_OVERPASS_TIMEOUT_SECONDS = 240
HTTP_MAX_RETRIES = 3
RETRY_BASE_DELAY_SECONDS = 3

SERVICE_QUERIES = {
    "police_station": [("amenity", "police")],
    "fire_station": [("amenity", "fire_station"), ("emergency", "fire_station")],
    "hospital": [("amenity", "hospital"), ("healthcare", "hospital")],
}


def build_overpass_query(tag_filters: list[tuple[str, str]], timeout_seconds: int = OVERPASS_TIMEOUT_SECONDS) -> str:
    """Build Overpass QL query for all Norway using ISO3166-1 country area."""
    query_lines = [f"[out:json][timeout:{timeout_seconds}];", "area[\"ISO3166-1\"=\"NO\"][admin_level=2]->.no;", "("]
    for key, value in tag_filters:
        query_lines.append(f"  node[\"{key}\"=\"{value}\"](area.no);")
        query_lines.append(f"  way[\"{key}\"=\"{value}\"](area.no);")
        query_lines.append(f"  relation[\"{key}\"=\"{value}\"](area.no);")
    query_lines.append(");")
    query_lines.append("out center;")
    return "\n".join(query_lines)


def _decode_json_response(raw: bytes, source_name: str, content_type: str) -> dict | None:
    """Decode JSON with good diagnostics for API errors and invalid responses."""
    text = raw.decode("utf-8", errors="replace")
    if not text.strip():
        print(f"    {source_name}-feil: tom respons", file=sys.stderr)
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        snippet = text[:250].replace("\n", " ")
        print(
            f"    {source_name}-feil: ugyldig JSON (content-type={content_type!r}) -> {snippet}",
            file=sys.stderr,
        )
        return None


def fetch_overpass(query: str, overpass_urls: list[str] | None = None, request_timeout_seconds: int = OVERPASS_TIMEOUT_SECONDS + 30) -> dict:
    """POST an Overpass QL query and return the parsed JSON."""
    data = ("data=" + urllib.parse.quote(query)).encode("utf-8")
    urls = overpass_urls or OVERPASS_URLS

    for attempt in range(1, HTTP_MAX_RETRIES + 1):
        for overpass_url in urls:
            req = urllib.request.Request(
                overpass_url,
                data=data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "GIS-Beredskap/1.0 (semester project)",
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=request_timeout_seconds) as resp:
                    content_type = resp.headers.get("Content-Type", "")
                    parsed = _decode_json_response(resp.read(), "Overpass", content_type)
                    if parsed is not None:
                        return parsed
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")[:250].replace("\n", " ")
                print(f"    Overpass HTTP-feil {exc.code} ({overpass_url}): {body}", file=sys.stderr)
            except Exception as exc:  # noqa: BLE001
                print(f"    Overpass-feil ({overpass_url}): {exc}", file=sys.stderr)

        if attempt < HTTP_MAX_RETRIES:
            delay = RETRY_BASE_DELAY_SECONDS * attempt
            print(f"    Forsoker pa nytt om {delay}s (forsok {attempt + 1}/{HTTP_MAX_RETRIES})...")
            time.sleep(delay)

    return {"elements": []}


def osm_elements_to_features(elements: list, app_type: str) -> list:
    """Convert OSM Overpass elements to app-compatible GeoJSON features."""
    features = []
    for el in elements:
        if el.get("type") == "node" and "lon" in el and "lat" in el:
            coords = [el["lon"], el["lat"]]
        elif el.get("type") in {"way", "relation"} and "center" in el:
            coords = [el["center"]["lon"], el["center"]["lat"]]
        else:
            continue

        tags = el.get("tags") or {}
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": tags.get("name") or tags.get("name:no") or app_type,
                    "type": app_type,
                    "municipality": tags.get("addr:city") or tags.get("addr:municipality") or "",
                    "phone": tags.get("phone") or tags.get("contact:phone") or tags.get("emergency") or "",
                    "source": "osm",
                    "osm_id": el.get("id"),
                },
                "geometry": {"type": "Point", "coordinates": coords},
            }
        )
    return features


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------


def deduplicate_by_name(features: list) -> list:
    """Return unique features, keeping first occurrence per stable key."""
    seen: set = set()
    unique = []
    for f in features:
        p = f.get("properties") or {}
        geom = (f.get("geometry") or {}).get("coordinates") or [None, None]
        key = (
            p.get("type") or "",
            p.get("osm_id") or "",
            (p.get("name") or "").strip().lower(),
            geom[0],
            geom[1],
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(f)
    return unique


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(
        "\n=== GIS Beredskap - Overpass (Norge) ===\n"
        f"Lagrer til: {OUTPUT_DIR.resolve()}\n"
    )

    print("Henter beredskapstjenester fra Overpass (hele Norge)")

    resources_by_type = {k: [] for k in SERVICE_QUERIES}
    for app_type, tag_filters in SERVICE_QUERIES.items():
        print(f"  - {app_type}")
        if app_type == "hospital":
            query = build_overpass_query(tag_filters, timeout_seconds=HOSPITAL_OVERPASS_TIMEOUT_SECONDS)
            data = fetch_overpass(
                query,
                overpass_urls=HOSPITAL_OVERPASS_URLS,
                request_timeout_seconds=HOSPITAL_OVERPASS_TIMEOUT_SECONDS + 45,
            )
        else:
            query = build_overpass_query(tag_filters)
            data = fetch_overpass(query)
        features = osm_elements_to_features(data.get("elements", []), app_type)
        resources_by_type[app_type].extend(features)
        print(f"    -> {len(features)} hentet")
        if len(features) == 0:
            print(f"    ! Advarsel: ingen data for {app_type} (mulig API-timeout eller rate limit)")
        time.sleep(1)

    total_written = 0
    for app_type, output_file in OUTPUT_FILE_BY_TYPE.items():
        typed_resources = deduplicate_by_name(resources_by_type.get(app_type, []))
        emergency_fc = {
            "type": "FeatureCollection",
            "name": app_type,
            "features": typed_resources,
        }
        output_file.write_text(json.dumps(emergency_fc, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nSkrev {len(typed_resources)} objekter til {output_file.name}")
        total_written += len(typed_resources)

    if LEGACY_OUTPUT_FILE.exists():
        LEGACY_OUTPUT_FILE.unlink()
        print(f"Fjernet gammel fil: {LEGACY_OUTPUT_FILE.name}")

    if total_written == 0:
        print("\nAdvarsel: ingen beredskapsobjekter ble skrevet")

    print("=== Ferdig ===")


if __name__ == "__main__":
    main()