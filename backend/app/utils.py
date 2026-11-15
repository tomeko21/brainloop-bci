import hashlib
import re
import time
import unicodedata


def now_ms() -> int:
    return int(time.time() * 1000)


# hash() is salted per process, this one survives restarts
def stable_hash(text: str) -> int:
    return int(hashlib.sha1(text.encode("utf-8")).hexdigest()[:8], 16)


def slug(text: str) -> str:
    # NFKD doesn't decompose ł, so 'Łukasz Ż.' would lose letters
    text = text.replace("ł", "l").replace("Ł", "L")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return text or "anon"
