"""Async SQLAlchemy engine + session dependency."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


class DatabaseUnavailable(RuntimeError):
    pass


async def create_tables() -> None:
    """Hackathon rule: no Alembic – tables are created on startup (existing tables are left alone)."""
    from app import models  # noqa: F401  (register models)

    s = get_settings()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # create_all never alters existing tables – small idempotent fixes for older DBs:
            await conn.exec_driver_sql("ALTER TABLE windows ALTER COLUMN bri_ai DROP NOT NULL")
    except Exception as e:  # wrong password / DB not running / DB missing
        raise DatabaseUnavailable(
            f"Cannot connect to PostgreSQL {s.db_user}@{s.db_host}:{s.db_port}/{s.db_name} "
            f"({type(e).__name__}: {e}). Check DB_* in backend/.env and that the database exists."
        ) from None
