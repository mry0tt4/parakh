"""Portfolio aggregates, alerts and audit-trail behaviour."""


def test_portfolio_summary_shape(client, officer):
    r = client.get("/api/v1/portfolio/summary", headers=officer)
    assert r.status_code == 200
    d = r.json()
    kpis = d["kpis"]
    assert kpis["total_applications"] >= 6
    assert set(kpis) >= {"total_applications", "pending_review", "approved_count",
                         "approval_rate", "avg_health_score", "total_requested",
                         "total_approved_amount", "avg_tat_minutes"}
    assert sum(s["count"] for s in d["status_funnel"]) == kpis["total_applications"]
    assert [g["grade"] for g in d["grade_distribution"]] == ["A+", "A", "B+", "B", "C", "D"]
    assert d["sector_mix"] and d["monthly_intake"]


def test_alerts_flag_fraud_and_stress(client, risk):
    r = client.get("/api/v1/portfolio/alerts", headers=risk)
    items = r.json()["items"]
    codes = {i["code"] for i in items}
    assert "CIRCULAR_FLOW" in codes           # rathore fraud
    assert "EWS_BOUNCE" in codes              # balaji stress
    # sorted most severe first
    sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    ranks = [sev_rank[i["severity"]] for i in items]
    assert ranks == sorted(ranks)


def test_audit_is_populated_and_filterable(client, risk):
    r = client.get("/api/v1/audit", headers=risk)
    assert r.status_code == 200
    total = r.json()["total"]
    assert total > 10

    r = client.get("/api/v1/audit", params={"action": "assessment"}, headers=risk)
    items = r.json()["items"]
    assert items and all("assessment" in e["action"] for e in items)

    r = client.get("/api/v1/audit", params={"actor": "officer@"}, headers=risk)
    items = r.json()["items"]
    assert items and all(e["actor_email"] == "officer@parakh.demo" for e in items)


def test_audit_grows_with_actions(client, officer, risk):
    before = client.get("/api/v1/audit", headers=risk).json()["total"]
    client.get("/api/v1/auth/me", headers=officer)  # reads are not audited
    client.post("/api/v1/auth/login",
                json={"email": "officer@parakh.demo", "password": "Officer@2026"})
    after = client.get("/api/v1/audit", headers=risk).json()["total"]
    assert after == before + 1  # exactly the login event


def test_meta_enums(client, officer):
    r = client.get("/api/v1/meta/enums", headers=officer)
    d = r.json()
    assert "working_capital" in d["products"]
    assert d["consent_sources"] == ["AA", "GST", "EPFO"]
    assert d["grades"][0] == "A+"


def test_security_headers_present(client):
    r = client.get("/api/v1/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Cache-Control"] == "no-store"
