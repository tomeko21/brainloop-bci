"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Session

DbDep = Annotated[AsyncSession, Depends(get_db)]


async def get_session_or_404(db: AsyncSession, session_id: str) -> Session:
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return session
