"""Settings from backend/.env. Relative paths resolve against backend/, not the cwd."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # separate DB_* fields instead of a URL so the password needs no escaping
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = ""
    db_name: str = "db_brainloop_bci"

    data_dir: Path = Path("../data")
    videos_dir: Path = Path("../dataset_videos")
    reels_csv: Path = Path("../dataset_videos/reels_metadata.csv")
    eeg_lsl_stream: str = ""  # Board stream to prefer when several headsets are on, empty means first found
    eeg_lsl_allow_remote: bool = False  # off so other teams' headsets on the same Wi-Fi are ignored
    eeg_channel_names: list[str] = [
        "F4",
        "F3",
        "C4",
        "C3",
        "P4",
        "P3",
        "O2",
        "O1",
    ]  # used when the LSL stream doesn't describe its channels
    cors_origins: list[str] = ["http://localhost:5173", "https://localhost:5173"]

    # live BRI imports feature code from data_acc so features match training
    data_acc_dir: Path = Path("../data_acc")
    live_model_path: Path = Path(
        "../data_acc/artifacts/7_live/live_model.joblib"
    )  # written by data_acc/export_live.py

    feed_default_batch: int = 5
    feed_max_batch: int = 20

    save_frames: bool = True
    frame_max_bytes: int = 400_000  # bigger camera frames are skipped

    @property
    def database_url(self) -> URL:
        return URL.create(
            "postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password or None,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    def resolve(self, p: Path) -> Path:
        return p if p.is_absolute() else (BACKEND_DIR / p).resolve()

    @property
    def data_path(self) -> Path:
        return self.resolve(self.data_dir)

    @property
    def videos_path(self) -> Path:
        return self.resolve(self.videos_dir)

    @property
    def data_acc_path(self) -> Path:
        return self.resolve(self.data_acc_dir)

    @property
    def live_model_file(self) -> Path:
        return self.resolve(self.live_model_path)

    @property
    def reels_csv_path(self) -> Path:
        return self.resolve(self.reels_csv)


@lru_cache
def get_settings() -> Settings:
    return Settings()
