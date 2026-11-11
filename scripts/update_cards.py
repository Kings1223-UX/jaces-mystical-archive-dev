
#!/usr/bin/env python3
"""
Jace's Mystical Archive
Automatic Scryfall Oracle Cards Database Updater

Supports:
- Scryfall JSONL bulk downloads
- Compressed .jsonl.gz files
- Legacy JSON array downloads
- Database version tracking
- GitHub Actions deployment
"""

import datetime
import gzip
import io
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_VERSION = 2
OUT = ROOT / "public"
OUT.mkdir(parents=True, exist_ok=True)

API = "https://api.scryfall.com/bulk-data/oracle-cards"

HEADERS = {
    "User-Agent": "JacesMysticalArchive/1.2",
    "Accept": "application/json",
}


def get(url):
    request = urllib.request.Request(
        url,
        headers=HEADERS
    )
    return urllib.request.urlopen(request, timeout=120)


# --------------------------------------------------
# 1. Retrieve Scryfall database metadata
# --------------------------------------------------

print("Checking Scryfall for updates...", flush=True)

with get(API) as response:
    meta = json.load(response)

if isinstance(meta, dict) and isinstance(meta.get("data"), dict):
    meta = meta["data"]

if not isinstance(meta, dict):
    raise RuntimeError("Unexpected Scryfall metadata format.")

# Support newer and older Scryfall bulk formats.
url = (
    meta.get("jsonl_download_uri")
    or meta.get("download_uri")
)

if not url:
    raise RuntimeError(
        "Scryfall did not provide a supported download URL. "
        f"Response: {json.dumps(meta)[:1500]}"
    )

version = meta.get("updated_at", "unknown")

print("Database version:", version, flush=True)
print("Download URL:", url, flush=True)


# --------------------------------------------------
# 2. Check existing database version
# --------------------------------------------------

version_file = OUT / "database-version.json"
cards_file = OUT / "cards.json"

if version_file.exists() and cards_file.exists():
    try:
        old = json.loads(version_file.read_text())

        if (old.get("updated_at") == version
                and old.get("schema_version") == SCHEMA_VERSION):
            print(
                "Database is already up to date.",
                flush=True
            )
            raise SystemExit(0)

    except (ValueError, KeyError):
        pass


# --------------------------------------------------
# 3. Define card fields
# --------------------------------------------------

FIELDS = (
    "name",
    "type_line",
    "oracle_text",
    "mana_cost",
    "power",
    "toughness",
    "colors",
    "color_identity",
    "layout",
    "id",
    "oracle_id",
    "cmc",
    "produced_mana",
    "legalities",
    "keywords",
)


def compact(card):
    result = {
        key: card[key]
        for key in FIELDS
        if key in card
    }

    if card.get("card_faces"):
        result["card_faces"] = [
            {
                key: face[key]
                for key in FIELDS
                if key in face
            }
            for face in card["card_faces"]
        ]

    return result


# --------------------------------------------------
# 4. Download and process bulk database
# --------------------------------------------------

print("Downloading Oracle Cards...", flush=True)

cards = []

with get(url) as response:

    is_gzip = (
        url.split("?")[0].endswith(".gz")
        or response.headers.get(
            "Content-Encoding", ""
        ).lower() == "gzip"
    )

    if is_gzip:
        stream = gzip.GzipFile(fileobj=response)
    else:
        stream = response

    buffered = io.BufferedReader(stream)

    # Detect whether the export is a JSON array
    # or JSONL without loading the entire file.
    first = buffered.peek(4096).lstrip()[:1]

    if first == b"[":

        print("Detected JSON array format.", flush=True)

        try:
            import ijson
        except ImportError:
            raise RuntimeError(
                "JSON array detected. "
                "Install ijson in GitHub Actions."
            )

        for card in ijson.items(buffered, "item"):
            if isinstance(card, dict) and card.get("name"):
                cards.append(compact(card))

    else:

        print("Detected JSONL format.", flush=True)

        for line in buffered:

            if not line.strip():
                continue

            card = json.loads(line)

            if isinstance(card, dict) and card.get("name"):
                cards.append(compact(card))

            if len(cards) % 10000 == 0 and len(cards) > 0:
                print(
                    f"Processed {len(cards)} cards...",
                    flush=True
                )


# --------------------------------------------------
# 5. Validate database
# --------------------------------------------------

count = len(cards)

if count < 1000:
    raise RuntimeError(
        f"Database validation failed: "
        f"only {count} cards found."
    )

print(
    f"Successfully validated {count} cards.",
    flush=True
)


# --------------------------------------------------
# 6. Publish compact card database
# --------------------------------------------------

temp_file = OUT / "cards.json.tmp"

with temp_file.open(
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        cards,
        file,
        ensure_ascii=False,
        separators=(",", ":")
    )

temp_file.replace(cards_file)


# --------------------------------------------------
# 7. Write database version metadata
# --------------------------------------------------

metadata = {
    "updated_at": version,
    "published_at": datetime.datetime.now(
        datetime.timezone.utc
    ).isoformat(),
    "count": count,
    "source": API,
    "schema_version": SCHEMA_VERSION,
}

version_file.write_text(
    json.dumps(metadata, indent=2) + "\n",
    encoding="utf-8"
)


# --------------------------------------------------
# 8. Confirm successful completion
# --------------------------------------------------

size_mb = cards_file.stat().st_size / 1_000_000

print("-----------------------------------")
print("Jace's Mystical Archive")
print("Database update successful!")
print(f"Cards processed: {count}")
print(f"Database size: {size_mb:.2f} MB")
print(f"Database version: {version}")
print("-----------------------------------")
