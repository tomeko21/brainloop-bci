"""Live engagement of a session, from the events the browser sends with every heartbeat (every 2 s).

Input = events.csv rows kept in memory (live_state): reel_view_start / reel_view_end (value = dwell ms),
reel_like / reel_unlike, reel_loop. Output = how interested the person is right now, whether they are
bored (skipping fast / watching little), the swipe rate and per-category affinity.

Everything here is explainable heuristics on top of real behaviour – the numbers are in ENGAGEMENT below.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.models import Reel
from app.schemas import LiveEvent

ENGAGEMENT = {
    "instant_skip_s": 2.0,  # left within this many seconds = no interest at all
    "like_bonus": 0.4,  # a like adds this to the reward of the view
    "loop_bonus": 0.2,  # watched past the end (loop) = strong interest
    "interest_views": 5,  # interest = recency-weighted mean reward of the last N views …
    "interest_decay": 0.8,  # … each older view counts 0.8× the next one
    "bored_interest": 0.30,  # interest below this (with ≥ 3 views) = bored
    "bored_median_dwell_s": 3.0,  # or median time on the last 4 reels below this = swiping through
    "affinity_decay": 0.9,  # category affinity: older views count less
    "affinity_prior": 0.5,  # unknown category = neutral
}


@dataclass
class ViewSignal:
    reel_id: str
    category: str
    start_ms: int
    dwell_s: float
    watch_frac: float  # dwell / reel duration (can be > 1 when looping)
    liked: bool

    @property
    def reward(self) -> float:
        """0 = skipped instantly … ~1.4 = watched fully, looped and liked."""
        if self.dwell_s < ENGAGEMENT["instant_skip_s"]:
            return 0.0
        r = 0.8 * min(self.watch_frac, 1.0) + (ENGAGEMENT["loop_bonus"] if self.watch_frac > 1.0 else 0.0)
        return r + (ENGAGEMENT["like_bonus"] if self.liked else 0.0)


@dataclass
class Engagement:
    views: int = 0
    interest: float | None = None  # 0..~1.4, None = no views yet
    bored: bool = False
    swipes_per_min: float | None = None
    median_dwell_s: float | None = None
    affinity: dict[str, float] = field(default_factory=dict)  # category -> 0..~1.4
    seen_per_category: dict[str, int] = field(default_factory=dict)


def views_from_events(events: list[LiveEvent], reels_by_id: dict[str, Reel]) -> list[ViewSignal]:
    """Pairs reel_view_start / reel_view_end into finished views (oldest first)."""
    liked: dict[str, bool] = {}
    starts: dict[str, int] = {}
    views: list[ViewSignal] = []
    for e in sorted(events, key=lambda e: e.ts_ms):
        if e.event in ("reel_like", "reel_unlike"):
            liked[e.reel_id] = e.event == "reel_like"
        elif e.event == "reel_view_start":
            starts[e.reel_id] = e.ts_ms
        elif e.event == "reel_view_end" and e.reel_id in reels_by_id:
            reel = reels_by_id[e.reel_id]
            dwell_ms = float(e.value) if e.value else e.ts_ms - starts.get(e.reel_id, e.ts_ms)
            duration_s = max(1.0, reel.duration or 15.0)
            views.append(
                ViewSignal(
                    reel_id=e.reel_id,
                    category=reel.category or "?",
                    start_ms=starts.get(e.reel_id, e.ts_ms - int(dwell_ms)),
                    dwell_s=dwell_ms / 1000,
                    watch_frac=dwell_ms / 1000 / duration_s,
                    liked=liked.get(e.reel_id, False),
                )
            )
    # a like given after leaving the reel still counts
    for v in views:
        v.liked = liked.get(v.reel_id, v.liked)
    return views


def assess(views: list[ViewSignal]) -> Engagement:
    if not views:
        return Engagement()
    E = ENGAGEMENT
    last = views[-int(E["interest_views"]) :][::-1]  # newest first
    w = [E["interest_decay"] ** i for i in range(len(last))]
    interest = sum(wi * v.reward for wi, v in zip(w, last, strict=True)) / sum(w)

    recent = views[-4:]
    dwells = sorted(v.dwell_s for v in recent)
    median_dwell = dwells[len(dwells) // 2]
    span_min = (views[-1].start_ms + views[-1].dwell_s * 1000 - views[-min(6, len(views))].start_ms) / 60_000
    swipes = min(6, len(views)) / span_min if span_min > 0 else None

    bored = (len(views) >= 3 and interest < E["bored_interest"]) or (
        len(views) >= 4 and median_dwell < E["bored_median_dwell_s"]
    )

    num: dict[str, float] = {}
    den: dict[str, float] = {}
    seen: dict[str, int] = {}
    for age, v in enumerate(reversed(views)):
        wi = E["affinity_decay"] ** age
        num[v.category] = num.get(v.category, 0.0) + wi * v.reward
        den[v.category] = den.get(v.category, 0.0) + wi
        seen[v.category] = seen.get(v.category, 0) + 1
    affinity = {c: (num[c] + E["affinity_prior"]) / (den[c] + 1.0) for c in num}

    return Engagement(
        views=len(views),
        interest=round(interest, 3),
        bored=bored,
        swipes_per_min=None if swipes is None or math.isinf(swipes) else round(swipes, 1),
        median_dwell_s=round(median_dwell, 1),
        affinity=affinity,
        seen_per_category=seen,
    )
