"""AuthN/AuthZ: login, tokens, role guards, officer decision limits."""
from tests.conftest import find_app


def test_login_ok(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "officer@parakh.demo", "password": "Officer@2026"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "credit_officer"
    assert body["expires_in"] > 0


def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "officer@parakh.demo", "password": "WrongPass1!"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "nobody@parakh.demo", "password": "Whatever1!"})
    assert r.status_code == 401


def test_me(client, officer):
    r = client.get("/api/v1/auth/me", headers=officer)
    assert r.status_code == 200
    assert r.json()["email"] == "officer@parakh.demo"


def test_requests_require_token(client):
    assert client.get("/api/v1/applications").status_code == 401
    assert client.get("/api/v1/portfolio/summary").status_code == 401


def test_garbage_token_rejected(client):
    r = client.get("/api/v1/applications",
                   headers={"Authorization": "Bearer not.a.token"})
    assert r.status_code == 401


def test_officer_cannot_view_audit_or_alerts(client, officer):
    assert client.get("/api/v1/audit", headers=officer).status_code == 403
    assert client.get("/api/v1/portfolio/alerts", headers=officer).status_code == 403


def test_risk_head_can_view_audit_and_alerts(client, risk):
    assert client.get("/api/v1/audit", headers=risk).status_code == 200
    assert client.get("/api/v1/portfolio/alerts", headers=risk).status_code == 200


def test_officer_decision_limit_enforced(client, officer, risk):
    balaji = find_app(client, officer, "Balaji")
    assert balaji["amount_requested"] > 2_500_000
    r = client.post(f"/api/v1/applications/{balaji['id']}/decision",
                    json={"decision": "rejected", "note": "over my limit"},
                    headers=officer)
    assert r.status_code == 403
    assert "officer discretion" in r.json()["detail"].lower() or "refer" in r.json()["detail"].lower()

    if balaji["status"] == "assessed":  # risk head may decide
        r = client.post(f"/api/v1/applications/{balaji['id']}/decision",
                        json={"decision": "rejected", "note": "Sustained stress; EWS confirmed."},
                        headers=risk)
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"


def test_rate_limiter_unit():
    from app.security import SlidingWindowLimiter
    lim = SlidingWindowLimiter()
    assert all(lim.check("k", 3) for _ in range(3))
    assert lim.check("k", 3) is False
    assert lim.check("other", 3) is True
