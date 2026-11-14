"""Choosing the next batch of reels – an engagement-maximising recommender (like a real short-video app).

The point of the experiment: the FEED tries to keep the person scrolling (more stimulation when they get
bored or their brain is under-aroused), the CALM FILTER on the frontend is the counter-measure
(it softens playback once BRI stays above 70). The two are deliberately independent.

Inputs (SelectionContext):
  - BRI (0..100, EEG headset today, camera model later; 25 = this person at rest)
      BRI above rest = (theta + alpha) / beta up = brain under-aroused -> "need" for stimulation,
  - engagement from live behaviour (app/services/engagement.py): interest, bored, per-category affinity,
  - escalation level of the session (kept between batches).

Per batch:
  1. need     = clip((BRI − 30) / 40, 0, 1)            (unknown BRI -> from behaviour only)
  2. level   += 1.2·need + 1.0·(bored & no favourite) − 0.6·(very interested & aroused)
              clipped to 2..9 (hybrid_brainrot_score scale)
              -> stimulation really escalates while the person drifts, and relaxes when they are hooked
  3. every candidate gets
        1.4·affinity(category)                      exploit what they watch / like
      − |hybrid_brainrot_score − level| / 2        match the escalation level (× 0.4 for favourites)
      + need·(0.8·loudness + 0.5·cut rate)          louder, faster-cut reels when under-aroused
      + 0.35 / √(1 + times category seen)          explore new topics
      + 0.2·popularity (engagement_rate)
      − topic penalty: bored -> −2.5 for the last 3 categories (switch topic!),
                       otherwise −1.0 per repeat of the last 2 (variety) unless binged (affinity ≥ 0.75)
      + small random jitter
     the best candidate is taken, the context updated, repeat until the batch is full.

TODO(team): replace the hand-made weights with a learned ranking once there are enough sessions.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from app.models import Reel
from app.services.engagement import Engagement

RECENT_WINDOW = 30  # when everything was served, only the last N reels are excluded

LEVEL = {"start": 4.5, "min": 2.0, "max": 9.0}
W = {
    "affinity": 1.4,
    "need_step": 1.2,  # level += need_step·need per batch
    "bored_step": 1.0,
    "hooked_step": -0.6,
    "level_fit": 0.5,  # per point of |score − level|
    "loud": 0.8,
    "pace": 0.5,
    "explore": 0.35,
    "popularity": 0.2,
    "bored_topic_penalty": 2.5,
    "repeat_penalty": 1.0,
    "binge_affinity": 0.75,
    "jitter": 0.5,
}

# Escalation level per session (in memory; a backend restart starts again from LEVEL["start"])
_levels: dict[str, float] = {}


def _hybrid(r: Reel) -> float:
    return r.hybrid_brainrot_score if r.hybrid_brainrot_score is not None else LEVEL["start"]


def _loudness(r: Reel) -> float:
    """audio_mean_db −35 dB (quiet) .. −5 dB (loud) -> 0..1; silent videos (−91 dB) = 0."""
    return min(1.0, max(0.0, ((r.audio_mean_db or -60.0) + 35.0) / 30.0))


def _pace(r: Reel) -> float:
    return min(1.0, (r.cuts_per_sec or 0.0) / 2.0)


def _popularity(r: Reel) -> float:
    return min(1.0, math.log1p(max(0.0, r.engagement_rate or 0.0)) / math.log1p(20.0))


@dataclass
class SelectionContext:
    session_id: str
    latest_bri: float | None  # 0..100, None = unknown (no headset, model not trained)
    served_ids: list[str]  # in serve order
    seed: int
    engagement: Engagement = field(default_factory=Engagement)


def arousal_need(bri: float | None) -> float | None:
    return None if bri is None else min(1.0, max(0.0, (bri - 30.0) / 40.0))


def _favourites(eng: Engagement) -> set[str]:
    """Categories they clearly enjoy (high affinity, seen ≥ 2×): never avoided, level fit relaxed."""
    return {
        c
        for c, a in eng.affinity.items()
        if a >= W["binge_affinity"] and eng.seen_per_category.get(c, 0) >= 2
    }


def _next_level(ctx: SelectionContext, need: float | None) -> float:
    eng = ctx.engagement
    level = _levels.get(ctx.session_id, LEVEL["start"])
    if need is not None:
        level += W["need_step"] * need
    if eng.bored and not _favourites(eng):  # bored and nothing hooks them -> more stimulation
        level += W["bored_step"]
    if eng.interest is not None and eng.interest > 0.7 and (need is None or need < 0.2):
        level += W["hooked_step"]
    level = min(LEVEL["max"], max(LEVEL["min"], level))
    _levels[ctx.session_id] = level
    return level


def select_batch(reels: list[Reel], ctx: SelectionContext, limit: int) -> tuple[list[Reel], str]:
    rng = random.Random(ctx.seed)
    served = set(ctx.served_ids)
    candidates = [r for r in reels if r.id not in served]  # `reels` = only reels with a video file
    if len(candidates) < limit:  # everything watched – allow repeats except the most recent ones
        recent = set(ctx.served_ids[-RECENT_WINDOW:])
        candidates = [r for r in reels if r.id not in recent]

    eng = ctx.engagement
    need = arousal_need(ctx.latest_bri)
    # Without BRI the behaviour alone decides how much extra stimulation to push
    need_eff = need if need is not None else (0.5 if eng.bored else 0.0)
    level = _next_level(ctx, need)

    by_id = {r.id: r for r in reels}
    recent_cats = [by_id[i].category for i in ctx.served_ids[-3:] if i in by_id]
    favs = _favourites(eng)
    # Bored -> switch topic: avoid the last categories, except the ones they love
    avoid = (set(recent_cats) - favs) if eng.bored else set()
    seen = dict(eng.seen_per_category)

    def score(r: Reel) -> float:
        cat = r.category or "?"
        aff = eng.affinity.get(cat, 0.5)
        s = W["affinity"] * aff
        s -= W["level_fit"] * abs(_hybrid(r) - level) * (0.4 if cat in favs else 1.0)
        s += need_eff * (W["loud"] * _loudness(r) + W["pace"] * _pace(r))
        s += W["explore"] / math.sqrt(1 + seen.get(cat, 0))
        s += W["popularity"] * _popularity(r)
        if cat in avoid:
            s -= W["bored_topic_penalty"]
        elif aff < W["binge_affinity"]:
            s -= W["repeat_penalty"] * recent_cats[-2:].count(cat)
        return s + rng.random() * W["jitter"]

    picked: list[Reel] = []
    pool = list(candidates)
    while pool and len(picked) < limit:
        best = max(pool, key=score)
        picked.append(best)
        pool.remove(best)
        recent_cats.append(best.category)
        seen[best.category] = seen.get(best.category, 0) + 1

    reason = (
        f"lvl={level:.1f} bri={'-' if ctx.latest_bri is None else round(ctx.latest_bri)}"
        f" need={need_eff:.2f} int={'-' if eng.interest is None else eng.interest}"
        f"{' BORED->switch' if eng.bored else ''}"
    )
    return picked, reason[:120]
