"""Picks the next batch of reels. Engagement-maximising on purpose, the calm filter is the counterweight."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from app.models import Reel
from app.services.engagement import Engagement

RECENT_WINDOW = 30  # once everything was served, only the last N are excluded

LEVEL = {"start": 4.5, "min": 2.0, "max": 9.0}  # on the hybrid_brainrot_score scale
W = {
    "affinity": 1.4,
    "need_step": 1.2,
    "bored_step": 1.0,
    "hooked_step": -0.6,
    "level_fit": 0.5,
    "loud": 0.8,
    "pace": 0.5,
    "explore": 0.35,
    "popularity": 0.2,
    "bored_topic_penalty": 2.5,
    "repeat_penalty": 1.0,
    "binge_affinity": 0.75,
    "jitter": 0.5,
}

# escalation level per session, in memory, resets on restart
_levels: dict[str, float] = {}


def _hybrid(r: Reel) -> float:
    return r.hybrid_brainrot_score if r.hybrid_brainrot_score is not None else LEVEL["start"]


# audio_mean_db -35 dB (quiet) to -5 dB (loud) mapped to 0..1
def _loudness(r: Reel) -> float:
    return min(1.0, max(0.0, ((r.audio_mean_db or -60.0) + 35.0) / 30.0))


def _pace(r: Reel) -> float:
    return min(1.0, (r.cuts_per_sec or 0.0) / 2.0)


def _popularity(r: Reel) -> float:
    return min(1.0, math.log1p(max(0.0, r.engagement_rate or 0.0)) / math.log1p(20.0))


@dataclass
class SelectionContext:
    session_id: str
    latest_bri: float | None
    served_ids: list[str]
    seed: int
    engagement: Engagement = field(default_factory=Engagement)


# BRI 30 or less gives 0, 70 and above gives 1
def arousal_need(bri: float | None) -> float | None:
    return None if bri is None else min(1.0, max(0.0, (bri - 30.0) / 40.0))


def _favourites(eng: Engagement) -> set[str]:
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
    if eng.bored and not _favourites(eng):
        level += W["bored_step"]
    if eng.interest is not None and eng.interest > 0.7 and (need is None or need < 0.2):
        level += W["hooked_step"]
    level = min(LEVEL["max"], max(LEVEL["min"], level))
    _levels[ctx.session_id] = level
    return level


def select_batch(reels: list[Reel], ctx: SelectionContext, limit: int) -> tuple[list[Reel], str]:
    rng = random.Random(ctx.seed)
    served = set(ctx.served_ids)
    candidates = [r for r in reels if r.id not in served]
    if len(candidates) < limit:
        recent = set(ctx.served_ids[-RECENT_WINDOW:])
        candidates = [r for r in reels if r.id not in recent]

    eng = ctx.engagement
    need = arousal_need(ctx.latest_bri)
    # without BRI only behaviour decides the extra stimulation
    need_eff = need if need is not None else (0.5 if eng.bored else 0.0)
    level = _next_level(ctx, need)

    by_id = {r.id: r for r in reels}
    recent_cats = [by_id[i].category for i in ctx.served_ids[-3:] if i in by_id]
    favs = _favourites(eng)
    # bored: switch topic, except categories they clearly like
    avoid = (set(recent_cats) - favs) if eng.bored else set()
    seen = dict(eng.seen_per_category)

    # affinity, level fit, louder/faster reels when under-aroused, exploration, popularity, topic penalties
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
