"""Timing and smoothing of the live BRI indicator."""

TICK_S = 0.5  # s, same as the step of the training windows
# s, the 2 s feature window ends this far before now because filtfilt has edge effects at the buffer end
WINDOW_LAG_S = 0.5
CLOCK_WINDOW_S = 20.0  # s, phone clock offset is the min delay over this window
BUFFER_S = 10.0  # s of raw EEG + face kept for filtering and spike detection (training used 10 s blocks)

# target = max(fast median, slow median): rises after a few s of scrolling, one calm window won't drop it
FAST_MEDIAN_S = 4.0
SLOW_MEDIAN_S = 12.0
TAU_UP_S = 1.5  # s, EMA when rising
TAU_DOWN_S = 5.0  # s, EMA when falling
MAX_UP_PER_S = 15.0  # BRI points/s
MAX_DOWN_PER_S = 4.0  # BRI points/s

HOLD_S = 20.0  # s without data before the value is marked stale (still shown)
DROP_AFTER_S = 90.0  # s without any data before BRI becomes null

BASELINE_MIN_WINDOWS = 20  # usable windows after the skipped start, ~10 s
# baseline std floor as a fraction of the training std, keeps z sane for near-constant features
STD_FLOOR_OF_DEFAULT = 0.5
