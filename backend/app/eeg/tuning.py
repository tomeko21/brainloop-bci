"""EEG processing constants – everything worth fine-tuning for the headset in one place.

The EEG pipeline is REAL (computed from the electrodes), but these numbers are first reasonable defaults.
TODO(team): validate them on recorded sessions (data/sessions/*/eeg_raw.csv) – especially PTP_MAX_GOOD_UV,
MIN_GOOD_CHANNELS, BASELINE_SECONDS and RATIO_FOR_FULL (what BRI value should mean "stop scrolling").
"""

# Snapshot rate sent to the admin panel / used for BRI
SNAPSHOT_EVERY_S = 0.1  # 10 snapshots/s – small, frequent updates = low latency in the admin panel

# Signal windows
RING_SECONDS = 4.0  # history kept per channel
PTP_WINDOW_S = 1.0  # peak-to-peak (like "PTP" in the BrainAccess app)
BANDS_WINDOW_S = 1.5  # band power (Welch) – shorter = faster reaction, longer = steadier values
WELCH_SEGMENT_S = 0.5  # Welch segment length (2 Hz frequency resolution, averaged over the window)

# Filters
BANDPASS_HZ = (1.0, 40.0)
NOTCH_HZ = 50.0  # mains hum in Europe (60 in the US)
NOTCH_Q = 30.0

# Contact quality from PTP (µV): ~0 = flat / not streaming, huge = saturated / no skin contact
PTP_FLAT_UV = 0.5
# Clean EEG (1–40 Hz, 1 s window) is ~20–150 µV peak-to-peak; above this the channel is dominated by
# movement / electrode artifacts and is not used for BRI.
PTP_MAX_GOOD_UV = 250.0
# Amplifier rail of the BrainAccess MINI (gain ×8): samples at ±562 500 µV are clipped.
# A channel with more than SATURATED_FRACTION of its samples at the rail = saturated (no skin contact).
# All channels saturated at once usually means the reference/bias electrode has no contact.
# (A large but varying DC offset – e.g. 250 000 µV – is normal for dry electrodes and is filtered out.)
RAIL_UV = 562_500.0
SATURATED_FRACTION = 0.2

# Frequency bands (Hz)
THETA = (4.0, 8.0)
ALPHA = (8.0, 12.0)
BETA = (13.0, 30.0)
# Relative band power is computed within 4–30 Hz: dry electrodes put most power into <4 Hz drift
TOTAL = (4.0, 30.0)

# BRI is computed only from reliable windows:
MIN_GOOD_CHANNELS = 3  # at least this many electrodes with good contact
# Keep the last BRI during short artifacts; after this long without a reliable window show "no data"
BRI_HOLD_S = 5.0

# ---- Artifact (blink / spike) rejection ----
# A blink or a jaw clench is a short, huge deflection (100–300 µV on F3/F4) on top of ~10–30 µV EEG.
# It leaks into theta and would push BRI up for the whole 1.5 s window. Per channel and window:
# robust sigma = 1.4826 × median absolute deviation (ignores the spike itself); if the biggest sample
# is more than SPIKE_SIGMA × sigma away, the channel is left out of the band powers for that window.
# Clean EEG peaks at ~3–4.5 sigma; blinks are 8–30 sigma. Lower = stricter.
SPIKE_SIGMA = 6.0

# Fatigue index = (theta + alpha) / beta. Absolute values differ a lot between people and headsets,
# so BRI is relative to a per-person baseline: the median ratio of the first BASELINE_SECONDS of clean
# signal (after connecting / at session start) = BASELINE_BRI;
# RATIO_FOR_FULL × baseline = BRI 100 (log scale).
#
# Baseline protocol: the feed starts with a 30 s fixation cross (relaxed, eyes open, looking at the cross)
# = resting-state reference, recorded via POST /api/eeg/baseline/start + /finish.
# Without the cross (headset connected later, admin only) the first BASELINE_SECONDS of clean signal are used.
BASELINE_SECONDS = 30
# Fixation cross: at least this much clean signal is needed, otherwise auto-calibration continues
BASELINE_MIN_CLEAN_S = 10
BASELINE_BRI = 25
RATIO_FOR_FULL = 4.0

# ---- BRI smoothing: brain state does not change in 100 ms, so no sudden jumps ----
# 0) band powers of a single 1.5 s window are very noisy (ratio jumps 5 -> 28 within seconds), so the
#    relative theta/alpha/beta powers are averaged over time FIRST (exponential, this τ), then divided
BANDS_TAU_S = 2.0
# 1) rolling MEDIAN of the raw fatigue over this many seconds -> removes spikes that survived step 1
BRI_MEDIAN_S = 3.0
# 2) exponential smoothing time constant (s) – smaller = faster but jumpier
BRI_TAU_S = 2.0
# 3) slew limit: BRI can change at most this many points per second
BRI_MAX_RATE_PER_S = 5.0

# Raw signal preview sent to the admin charts (like the BrainAccess app): decimated to this rate
WAVE_HZ = 50
# "Stop scrolling" alert with hysteresis (fatigue 0..1)
STOP_ON = 0.72
STOP_OFF = 0.62

# Electrode activity for the brain map: relative (theta+alpha) power mapped 0..1 between these values
ACTIVITY_REL_LOW = 0.4
ACTIVITY_REL_HIGH = 0.95

STANDARD_GRAVITY = 9.80665  # accelerometer m/s² -> g

# If the worker process dies, wait this long before restarting it
WORKER_RESTART_S = 5.0
