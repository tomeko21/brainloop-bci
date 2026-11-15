"""EEG processing constants. First reasonable defaults, worth checking against recorded eeg_raw.csv."""

SNAPSHOT_EVERY_S = 0.1  # s, snapshot rate for the admin panel and BRI

RING_SECONDS = 4.0  # s of history per channel
PTP_WINDOW_S = 1.0  # s, peak-to-peak like in the BrainAccess app
BANDS_WINDOW_S = 1.5  # s, Welch window. Shorter reacts faster, longer is steadier
WELCH_SEGMENT_S = 0.5  # s, 2 Hz resolution

BANDPASS_HZ = (1.0, 40.0)  # Hz
NOTCH_HZ = 50.0  # Hz, mains in Europe (60 in the US)
NOTCH_Q = 30.0

PTP_FLAT_UV = 0.5  # µV, below this the channel is flat / not streaming
PTP_MAX_GOOD_UV = 250.0  # µV, clean EEG is ~20 to 150 µV ptp, above this artifacts dominate
# a large but varying DC offset (e.g. 250 000 µV) is normal for dry electrodes and gets filtered out
RAIL_UV = 562_500.0  # µV, amplifier rail of the MINI at gain x8
SATURATED_FRACTION = 0.2  # share of samples at the rail that marks a channel as having no skin contact

# frequency bands, Hz
THETA = (4.0, 8.0)
ALPHA = (8.0, 12.0)
BETA = (13.0, 30.0)
TOTAL = (4.0, 30.0)  # relative power within 4 to 30 Hz, dry electrodes put most power into drift below 4 Hz

MIN_GOOD_CHANNELS = 3  # good electrodes needed for a BRI window
BRI_HOLD_S = 5.0  # s to keep the last BRI through artifacts before showing no data

SPIKE_SIGMA = 6.0  # blink/spike threshold in robust sigmas. Clean EEG peaks at ~3 to 4.5, blinks at 8 to 30

BASELINE_SECONDS = 30  # s of clean signal for the auto baseline (no fixation cross)
BASELINE_MIN_CLEAN_S = 10  # s of clean signal the fixation cross must yield, else auto calibration continues
BASELINE_BRI = 25  # BRI at the personal resting ratio
RATIO_FOR_FULL = 4.0  # (theta + alpha) / beta at this multiple of the baseline gives BRI 100, log scale

BANDS_TAU_S = 2.0  # s, band powers are averaged before the ratio, single windows jump a lot
BRI_MEDIAN_S = 3.0  # s, rolling median of the raw value
BRI_TAU_S = 2.0  # s, EMA time constant
BRI_MAX_RATE_PER_S = 5.0  # max BRI points per second

WAVE_HZ = 50  # Hz, raw preview for the admin charts
# stop-scrolling alert with hysteresis, fatigue 0..1
STOP_ON = 0.72
STOP_OFF = 0.62

# brain map: relative theta + alpha power mapped to 0..1 between these
ACTIVITY_REL_LOW = 0.4
ACTIVITY_REL_HIGH = 0.95

STANDARD_GRAVITY = 9.80665  # m/s², accelerometer to g

WORKER_RESTART_S = 5.0  # s before restarting a dead worker process
