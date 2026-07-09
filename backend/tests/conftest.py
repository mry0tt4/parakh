import os
import tempfile

_tmpdir = tempfile.mkdtemp(prefix="parakh-test-")
os.environ["PARAKH_DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
os.environ["PARAKH_AUTOSEED"] = "true"
os.environ["PARAKH_RATE_LIMIT_PER_MINUTE"] = "100000"
os.environ["PARAKH_LOGIN_RATE_LIMIT_PER_MINUTE"] = "100000"
os.environ["PARAKH_JWT_SECRET"] = "test-secret-not-for-production-0123456789abcdef"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # lifespan: create tables + seed
        yield c


def _login(client: TestClient, email: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def officer(client):
    return {"Authorization": f"Bearer {_login(client, 'officer@parakh.demo', 'Officer@2026')}"}


@pytest.fixture(scope="session")
def risk(client):
    return {"Authorization": f"Bearer {_login(client, 'risk@parakh.demo', 'Risk@2026')}"}


@pytest.fixture(scope="session")
def admin(client):
    return {"Authorization": f"Bearer {_login(client, 'admin@parakh.demo', 'Admin@2026')}"}


def find_app(client, headers, search: str) -> dict:
    r = client.get("/api/v1/applications", params={"search": search}, headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items, f"no application matching {search!r}"
    return items[0]
