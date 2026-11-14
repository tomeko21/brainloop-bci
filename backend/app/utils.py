"""Small helpers shared across the app."""

import hashlib
import re
import time
import unicodedata


def now_ms() -> int:
    return int(time.time() * 1000)


def stable_hash(text: str) -> int:
    """Deterministic hash (Python's hash() is randomized per process)."""
    return int(hashlib.sha1(text.encode("utf-8")).hexdigest()[:8], 16)


def slug(text: str) -> str:
    """'Łukasz Ż.' -> 'lukasz-z' (safe for folder names)."""
    text = text.replace("ł", "l").replace("Ł", "L")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return text or "anon"
