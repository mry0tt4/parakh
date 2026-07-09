"""Engine unit tests: determinism, scoring bounds, fraud gates, stress
behaviour, memo integrity — no HTTP involved."""
import pytest

from app import engines, synth
from app.engines import features, scoring
from app.engines.features import linear_fit, piecewise


def _assess(key: str, product: str, amount: int, tenure: int) -> dict:
    p = synth.PERSONAS[key]
    payloads = {"AA": synth.bank_payload(p), "GST": synth.gst_payload(p),
                "EPFO": synth.epfo_payload(p)}
    applicant = {"business_name": p.business_name, "sector": p.sector,
                 "entity_type": p.entity_type, "city": p.city, "state": p.state,
                 "gstin_masked": p.gstin, "incorporation_date": p.incorporation_date,
                 "is_ntc": p.is_ntc, "is_ntb": p.is_ntb}
    application = {"ref": "PRK-TEST", "product": product, "amount_requested": amount,
                   "tenure_months": tenure, "purpose": "test", "engine_version": "1.0.0"}
    return engines.run_assessment(applicant=applicant, application=application,
                                  payloads=payloads, consents=[])


def test_synth_is_deterministic():
    a = synth.bank_payload(synth.PERSONAS["nexus_digital"])
    b = synth.bank_payload(synth.PERSONAS["nexus_digital"])
    assert a == b


def test_fraudster_is_caught_and_capped():
    out = _assess("rathore_textiles", "working_capital", 2_000_000, 12)
    codes = {f["code"] for f in out["triangulation"]["fraud_flags"]}
    assert "CIRCULAR_FLOW" in codes
    assert out["verification_index"] < 40
    assert out["health_score"] <= 480
    assert out["grade"] == "D"
    assert out["recommendation"]["action"] == "DECLINE"
    assert out["recommendation"]["suggested_limit"] == 0


def test_healthy_borrower_approved():
    out = _assess("nexus_digital", "working_capital", 1_500_000, 24)
    assert out["health_score"] >= 750
    assert out["verification_index"] >= 90
    assert out["pd_12m"] < 0.05
    assert out["recommendation"]["action"] == "APPROVE"


def test_stressed_borrower_declined_with_ews():
    out = _assess("balaji_auto", "term_loan", 5_000_000, 48)
    assert out["pd_12m"] > 0.5
    assert out["stress"]["first_breach_month"] is not None
    assert out["recommendation"]["action"] == "DECLINE"
    codes = {s["code"] for s in out["stress"]["ews_signals"]}
    assert "EWS_BOUNCE" in codes and "EWS_GST_DELAY" in codes


def test_thin_file_right_sizing():
    out = _assess("greenleaf_organics", "working_capital", 800_000, 18)
    rec = out["recommendation"]
    assert rec["action"] == "APPROVE_CONDITIONAL"
    assert 0 < rec["suggested_limit"] < 800_000


def test_under_declaration_warns_but_passes():
    out = _assess("saraswati_kirana", "working_capital", 600_000, 36)
    gst_check = next(c for c in out["triangulation"]["checks"] if c["key"] == "gst_vs_bank")
    assert gst_check["status"] == "WARN"
    assert not out["triangulation"]["fraud_flags"]
    assert out["health_score"] >= 650


def test_score_shape_and_bounds():
    for key in synth.PERSONAS:
        out = _assess(key, "working_capital", 1_000_000, 24)
        assert 300 <= out["health_score"] <= 900
        assert 0 <= out["verification_index"] <= 100
        assert 0.0 <= out["pd_12m"] <= 1.0
        assert len(out["pillars"]) == 5
        assert abs(sum(p["weight"] for p in out["pillars"]) - 1.0) < 1e-9
        assert len(out["stress"]["curve"]) == 12
        assert len(out["triangulation"]["checks"]) == 6


def test_stress_curve_cumulative_is_monotone():
    out = _assess("balaji_auto", "term_loan", 5_000_000, 48)
    curve = out["stress"]["curve"]
    cums = [c["cumulative_prob"] for c in curve]
    assert cums == sorted(cums)
    assert all(c["stress_prob"] >= 0 for c in curve)


def test_memo_is_deterministic_and_cited():
    out1 = _assess("meher_foods", "term_loan", 2_500_000, 36)
    out2 = _assess("meher_foods", "term_loan", 2_500_000, 36)
    # memo differs only in its generation timestamp line
    strip = lambda md: "\n".join(l for l in md.splitlines() if not l.startswith("*Generated"))
    assert strip(out1["memo_markdown"]) == strip(out2["memo_markdown"])
    assert "PRK-TEST" in out1["memo_markdown"]
    assert {c["tag"] for c in out1["memo_citations"]} == {"S1", "S2", "S3", "S4"}
    assert "## 8. Recommendation" in out1["memo_markdown"]


def test_assessment_degrades_without_epfo():
    p = synth.PERSONAS["nexus_digital"]
    payloads = {"AA": synth.bank_payload(p), "GST": synth.gst_payload(p)}
    out = engines.run_assessment(
        applicant={"business_name": p.business_name, "sector": p.sector,
                   "entity_type": p.entity_type, "city": p.city, "state": p.state,
                   "gstin_masked": p.gstin, "incorporation_date": p.incorporation_date,
                   "is_ntc": True, "is_ntb": True},
        application={"ref": "PRK-TEST", "product": "working_capital",
                     "amount_requested": 1_000_000, "tenure_months": 24,
                     "purpose": "t", "engine_version": "1.0.0"},
        payloads=payloads, consents=[])
    payroll = next(c for c in out["triangulation"]["checks"] if c["key"] == "payroll_plausibility")
    assert payroll["status"] == "WARN"
    assert 300 <= out["health_score"] <= 900


def test_emi_principal_roundtrip():
    emi = scoring.emi_for(1_000_000, 24)
    assert scoring.principal_for(emi, 24) == pytest.approx(1_000_000, rel=1e-6)
    assert scoring.emi_for(0, 24) == 0.0
    assert scoring.principal_for(0, 24) == 0.0


def test_math_helpers():
    assert piecewise(-5, [(0, 10), (1, 90)]) == 10
    assert piecewise(5, [(0, 10), (1, 90)]) == 90
    assert piecewise(0.5, [(0, 0), (1, 100)]) == pytest.approx(50)
    a, b, r2, sigma = linear_fit([1, 2, 3, 4, 5])
    assert b == pytest.approx(1.0)
    assert r2 == pytest.approx(1.0)
    a, b, r2, sigma = linear_fit([7.0])
    assert (a, b) == (7.0, 0.0)


def test_procedural_persona_flows_end_to_end():
    fields = dict(business_name="Test Traders", gstin="27ZZTST1234Z1Z9", pan="ZZTST1234Z",
                  sector="Retail Trade", entity_type="proprietorship", city="Pune",
                  state="Maharashtra", incorporation_date="2021-01-01",
                  is_ntc=True, is_ntb=True)
    p = synth.procedural_persona(**fields)
    bank = synth.bank_payload(p)
    assert len(bank["transactions"]) > 200
    f = features.build_features(bank, synth.gst_payload(p), synth.epfo_payload(p))
    assert len(f.rows) == p.history_months
