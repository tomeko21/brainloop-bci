"""Record EEG and save it as an MNE file.

Connects to a headset with the ``brainaccess.utils.acquisition.EEG`` helper,
records for about 15 seconds while sending one annotation per second, saves the
recording in MNE's FIF format and plots it after a 1-40 Hz band-pass filter.

Set the ``BA_DEVICE`` environment variable to the name printed on your headset
(for example ``BA_DEVICE="BA HALO 001"``), or edit ``device_name`` below.
"""

import os
import time

import matplotlib.pyplot as plt

from brainaccess.core.eeg_manager import EEGManager
from brainaccess.utils import acquisition

# Electrodes to record: keys are 0-based electrode indices on the headset,
# values are the names of the channels in the recording.
cap: dict = {
    0: "Fp1",
    1: "Fp2",
    2: "O1",
    3: "O2",
}

device_name = os.environ.get("BA_DEVICE", "BA HALO 001")  # name printed on your headset

eeg = acquisition.EEG()

with EEGManager() as mgr:
    eeg.setup(mgr, device_name=device_name, cap=cap, sfreq=250)

    eeg.start_acquisition()
    print("Acquisition started")
    time.sleep(3)  # let the signal settle before the first annotation

    # Send one annotation per second for 10 seconds.
    start_time = time.time()
    annotation = 1
    while time.time() - start_time < 10:
        time.sleep(1)
        print(f"Sending annotation {annotation} to the device")
        eeg.annotate(str(annotation))
        annotation += 1

    time.sleep(2)  # keep recording a little after the last annotation

    # Stop first, so that the recording contains every received sample.
    eeg.stop_acquisition()
    raw = eeg.get_mne()
    mgr.disconnect()

# Save the recording in MNE's FIF format.
raw.save(f"{time.strftime('%Y%m%d_%H%M')}-raw.fif", overwrite=True)

# Release the BrainAccess library.
eeg.close()

# Show the recording, band-pass filtered between 1 and 40 Hz.
raw.copy().filter(1, 40).plot(scalings="auto", verbose=False)
plt.show()