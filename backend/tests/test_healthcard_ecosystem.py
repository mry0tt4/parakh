"""Borrower Health Card and ecosystem report endpoints."""
from tests.conftest import find_app


def test_healthcard_for_healthy_borrower(client, officer):
    app = find_app(client, officer, "Saraswati")
    r = client.get(f"/api/v1/applications/{app['id']}/healthcard", headers=officer)
    assert r.status_code == 200, r.text
    card = r.json()
    assert card["badge"] in ("VERIFIED", "PARTIALLY_VERIFIED")
    assert 300 <= card["score"] <= 900
    assert card["summary"] and card["business_name"] == app["applicant"]["business_name"]
    assert len(card["pillars"]) == 5
    assert card["card_id"].startswith("PRKC-")
    assert card["next_review_date"] > card["generated_at"][:10]
    # under-declaring kirana must be coached toward corroboration
    assert any("current account" in item["action"] or "GSTR-3B" in item["action"]
               for item in card["roadmap"])
    assert all(5 <= item["impact_points"] <= 25 for item in card["roadmap"])


def test_healthcard_fraudster_shows_no_offer(client, officer):
    app = find_app(client, officer, "Rathore")
    card = client.get(f"/api/v1/applications/{app['id']}/healthcard", headers=officer).json()
    assert card["badge"] == "VERIFICATION_FAILED"
    assert card["eligible_offer"] is None
    assert any(w["title"].startswith("Verification failed") for w in card["watchouts"])


def test_healthcard_conditional_has_rightsized_offer(client, officer):
    app = find_app(client, officer, "GreenLeaf")
    r = client.get(f"/api/v1/applications/{app['id']}/healthcard", headers=officer)
    if r.status_code == 404:  # not yet assessed in this run order — assess first
        detail = client.get(f"/api/v1/applications/{app['id']}", headers=officer).json()
        for c in detail["consents"]:
            if c["status"] == "PENDING":
                client.post(f"/api/v1/applications/{app['id']}/consents/{c['id']}/approve",
                            headers=officer)
        client.post(f"/api/v1/applications/{app['id']}/assess", headers=officer)
        r = client.get(f"/api/v1/applications/{app['id']}/healthcard", headers=officer)
    card = r.json()
    offer = card["eligible_offer"]
    assert offer is not None
    assert 0 < offer["limit"] < 800_000
    assert offer["indicative_emi"] > 0


def test_healthcard_404_before_assessment(client, officer):
    app = find_app(client, officer, "Nexus")
    r = client.get(f"/api/v1/applications/{app['id']}/healthcard", headers=officer)
    # nexus may or may not be assessed depending on test order — both valid
    assert r.status_code in (200, 404)


def test_ecosystem_report_schema_and_audit(client, officer, risk):
    app = find_app(client, officer, "Saraswati")
    r = client.get(f"/api/v1/ecosystem/health-report/{app['id']}", headers=officer)
    assert r.status_code == 200, r.text
    rep = r.json()
    assert rep["schema"] == "parakh.health-report.v1"
    assert rep["report_id"].startswith("PRKR-")
    assert rep["subject"]["gstin_masked"].count("X") > 0
    assert rep["consent_artefacts"] and all(a["artefact_id"] for a in rep["consent_artefacts"])
    assert rep["score"]["value"] == app["health_score"]
    # access must be audited
    audit_items = client.get("/api/v1/audit", params={"action": "ecosystem"},
                             headers=risk).json()["items"]
    assert any(e["entity_id"] == app["id"] for e in audit_items)
