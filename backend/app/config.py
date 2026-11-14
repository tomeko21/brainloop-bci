"""Application settings (read from environment / backend/.env)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Local PostgreSQL (no Docker) – pieces instead of one URL, so special characters
    # in the password need no escaping
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = ""
    db_name: str = "db_brainloop_bci"

    data_dir: Path = Path("../data")
    videos_dir: Path = Path("../dataset_videos")
    reels_csv: Path = Path("../dataset_videos/reels_metadata.csv")
    # BrainAccess Board LSL stream to use when several headsets are connected (empty = first one)
    eeg_lsl_stream: str = ""
    # Also accept Board streams from OTHER computers on the network (off: other teams' headsets are ignored)
    eeg_lsl_allow_remote: bool = False
    # Fallback electrode names if the stream does not describe its channels
    eeg_channel_names: list[str] = ["F4", "F3", "C4", "C3", "P4", "P3", "O2", "O1"]
    cors_origins: list[str] = ["http://localhost:5173", "https://localhost:5173"]

    # Feed
    feed_default_batch: int = 5
    feed_max_batch: int = 20

    # Camera frames sent by the frontend
    save_frames: bool = True
    frame_max_bytes: int = 400_000

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
        """Relative paths are relative to backend/, so the app works from any cwd."""
        return p if p.is_absolute() else (BACKEND_DIR / p).resolve()

    @property
    def data_path(self) -> Path:
        return self.resolve(self.data_dir)

    @property
    def videos_path(self) -> Path:
        return self.resolve(self.videos_dir)

    @property
    def reels_csv_path(self) -> Path:
        return self.resolve(self.reels_csv)


@lru_cache
def get_settings() -> Settings:
    return Settings()
