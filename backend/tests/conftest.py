import os
from collections.abc import AsyncIterator

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["AI_MODE"] = "fake"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.fake import FakeProvider
from app.db.base import Base
from app.db.seed import seed_demo
from app.db.session import get_session
from app.main import app

test_engine = create_async_engine(os.environ["DATABASE_URL"])
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def override_session() -> AsyncIterator[AsyncSession]:
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_session] = override_session
app.state.ai_provider = FakeProvider()


@pytest_asyncio.fixture(autouse=True)
async def database():
    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    async with TestSession() as session:
        await seed_demo(session)
    yield


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as test_client:
        yield test_client

