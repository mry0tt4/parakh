"""Full application lifecycle through the HTTP API, plus state-machine and
validation guarantees."""

NEW_APP = {
    "applicant": {
        "business_name": "Chandra Engineering Works",
        "gstin": "27ABCCE9271F1Z6", "pan": "ABCCE9271F",
        "sector": "Auto Components Manufacturing", "entity_type": "partnership",
        "city": "Aurangabad", "state": "Maharashtra",
        "incorporation_date": "2020-02-10", "is_ntc": True, "is_ntb": True,
    },
    "product": "working_capital",
    "amount_requested": 1_200_000,
    "tenure_months": 24,
    "purpose": "Raw material working capital for a new OEM order",
}


def test_full_lifecycle(client, officer):
    # create → draft
    r = client.post("/api/v1/applications", json=NEW_APP, headers=officer)
    assert r.status_code == 201, r.text
    app = r.json()
    assert app["status"] == "draft"
    assert app["ref"].startswith("PRK-")
    assert app["applicant"]["gstin_masked"] != NEW_APP["applicant"]["gstin"]
    assert "X" in app["applicant"]["gstin_masked"]
    app_id = app["id"]

    # premature assessment → 409
    assert client.post(f"/api/v1/applications/{app_id}/assess", headers=officer).status_code == 409
    # premature decision → 409
    r = client.post(f"/api/v1/applications/{app_id}/decision",
                    json={"decision": "approved", "note": ""}, headers=officer)
    assert r.status_code == 409

    # consents
    r = client.post(f"/api/v1/applications/{app_id}/consents",
                    json={"sources": ["AA", "GST", "EPFO"]}, headers=officer)
    assert r.status_code == 201
    consents = r.json()["consents"]
    assert len(consents) == 3 and all(c["status"] == "PENDING" for c in consents)

    # repeated request is idempotent (no duplicates)
    r = client.post(f"/api/v1/applications/{app_id}/consents",
                    json={"sources": ["AA", "GST", "EPFO"]}, headers=officer)
    assert len(r.json()["consents"]) == 3

    # approve all consents → data_ready
    for c in consents:
        r = client.post(f"/api/v1/applications/{app_id}/consents/{c['id']}/approve",
                        headers=officer)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ACTIVE"
        assert body["data_pull"]["record_count"] > 0
        assert len(body["data_pull"]["sha256"]) == 64
        # double approval → 409
        assert client.post(f"/api/v1/applications/{app_id}/consents/{c['id']}/approve",
                           headers=officer).status_code == 409
    r = client.get(f"/api/v1/applications/{app_id}", headers=officer)
    assert r.json()["status"] == "data_ready"

    # assess
    r = client.post(f"/api/v1/applications/{app_id}/assess", headers=officer)
    assert r.status_code == 200, r.text
    asm = r.json()
    assert 300 <= asm["health_score"] <= 900
    assert len(asm["pillars"]) == 5
    assert len(asm["stress"]["curve"]) == 12
    assert asm["version"] == 1

    # re-assess bumps version
    r = client.post(f"/api/v1/applications/{app_id}/assess", headers=officer)
    assert r.json()["version"] == 2

    # memo
    r = client.get(f"/api/v1/applications/{app_id}/memo", headers=officer)
    assert r.status_code == 200
    memo = r.json()
    assert app["ref"] in memo["memo_markdown"]
    assert len(memo["citations"]) == 4

    # cashflow + transactions
    r = client.get(f"/api/v1/applications/{app_id}/cashflow", headers=officer)
    months = r.json()["months"]
    assert len(months) >= 12
    assert all(set(m) >= {"month", "inflow", "outflow", "net", "gst_turnover"} for m in months)
    some_month = months[-1]["month"]
    r = client.get(f"/api/v1/applications/{app_id}/transactions",
                   params={"month": some_month, "page_size": 10}, headers=officer)
    tx = r.json()
    assert tx["total"] > 0 and len(tx["items"]) <= 10
    assert all(t["date"].startswith(some_month) for t in tx["items"])

    # decision (within officer limit)
    r = client.post(f"/api/v1/applications/{app_id}/decision",
                    json={"decision": "approved", "note": "test approval"}, headers=officer)
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    # decision is terminal → 409
    r = client.post(f"/api/v1/applications/{app_id}/decision",
                    json={"decision": "rejected", "note": "flip"}, headers=officer)
    assert r.status_code == 409

    # timeline captured the whole journey
    r = client.get(f"/api/v1/applications/{app_id}/timeline", headers=officer)
    actions = [e["action"] for e in r.json()["items"]]
    for expected in ("application.create", "consent.request", "consent.approve",
                     "application.data_ready", "assessment.run", "application.decision"):
        assert expected in actions


def test_validation_rejects_bad_input(client, officer):
    bad = {**NEW_APP, "applicant": {**NEW_APP["applicant"], "gstin": "SHORT"}}
    assert client.post("/api/v1/applications", json=bad, headers=officer).status_code == 422
    bad = {**NEW_APP, "amount_requested": -5}
    assert client.post("/api/v1/applications", json=bad, headers=officer).status_code == 422
    bad = {**NEW_APP, "product": "crypto_loan"}
    assert client.post("/api/v1/applications", json=bad, headers=officer).status_code == 422


def test_unknown_application_404(client, officer):
    assert client.get("/api/v1/applications/app_nope", headers=officer).status_code == 404
    assert client.post("/api/v1/applications/app_nope/assess", headers=officer).status_code == 404


def test_unknown_status_filter_422(client, officer):
    r = client.get("/api/v1/applications", params={"status": "bogus"}, headers=officer)
    assert r.status_code == 422
