"""Assessment orchestrator: payloads → triangulation → score → stress →
recommendation → memo.

Pure function of its inputs (no DB access) — trivially testable and ready to
move behind a worker queue for horizontal scale.
"""
from ..config import get_settings
from . import features, memo, scoring, stress, triangulation

settings = get_settings()

WC_TURNOVER_CAP = {"working_capital": 0.25, "invoice_finance": 0.30, "term_loan": 0.35}


def _round_limit(v: float) -> int:
    return int(round(max(v, 0) / 50_000) * 50_000)


def _recommend(*, f: features.Features, score_out: dict, tri: dict, stress_out: dict,
               product: str, amount_requested: int, tenure_months: int) -> dict:
    c = score_out["computed"]
    score, pd12 = score_out["health_score"], stress_out["pd_12m"]
    has_critical = any(fl["severity"] == "critical" for fl in tri["fraud_flags"])

    # affordability-based right-sizing
    max_service = c["avg_available_monthly"] / settings.target_dscr
    max_new_emi = max(0.0, max_service - c["existing_emi_monthly"])
    dscr_cap = scoring.principal_for(max_new_emi, tenure_months)
    turnover_cap = WC_TURNOVER_CAP.get(product, 0.25) * c["verified_annual_revenue"]
    suggested = _round_limit(min(amount_requested, dscr_cap, turnover_cap))

    if has_critical:
        return {
            "action": "DECLINE", "suggested_limit": 0,
            "conditions": ["Refer to Fraud Control Unit before any re-application",
                           "Do not rely on declared GST turnover for this applicant"],
            "rationale": ("Critical verification failures (see fraud indicators): the declared scale of the "
                          "business is not supported by its banked cash flows. Pillar-level performance is "
                          "irrelevant while the underlying data is untrustworthy."),
        }

    # PD at the right-sized limit is the fair basis when we lend less than asked
    pd_at_suggested = pd12
    if suggested < amount_requested and suggested > 0:
        pd_at_suggested = stress.run(f, scoring.emi_for(suggested, tenure_months))["pd_12m"]

    if score >= 700 and pd12 < 0.15 and suggested >= 0.9 * amount_requested:
        return {
            "action": "APPROVE", "suggested_limit": int(amount_requested),
            "conditions": ["Standard facility covenants", "Annual review with refreshed AA + GST pull"],
            "rationale": (f"Verified cash flows support the full request: DSCR {c['dscr_proposed']}× against a "
                          f"1.4× target, 12-month stress probability {pd12:.0%}, verification index {tri['index']}/100."),
        }
    if score >= 620 and suggested >= 0.25 * amount_requested and pd_at_suggested < 0.30:
        conditions = [f"Limit right-sized to {suggested:,} against requested {amount_requested:,}"
                      if suggested < amount_requested else "Limit as requested",
                      "Quarterly GST filing check via consented refresh",
                      "Step-up review after 6 months of clean conduct"]
        return {
            "action": "APPROVE_CONDITIONAL", "suggested_limit": suggested,
            "conditions": conditions,
            "rationale": (f"The business is viable but the requested exposure is not fully supported today. "
                          f"At {('₹%.1fL' % (suggested / 1e5))} the projected 12-month stress probability is "
                          f"{pd_at_suggested:.0%} and DSCR stays within tolerance — approve right-sized with a "
                          f"growth step-up path."),
        }
    if score >= 550 and pd12 < 0.45:
        return {
            "action": "REFER", "suggested_limit": suggested,
            "conditions": ["Obtain 12 more months of statements or collateral support",
                           "Risk-committee sign-off required"],
            "rationale": (f"Marginal case: health score {score} with 12-month stress probability {pd12:.0%}. "
                          "Outside officer discretion — refer with the verification annexure."),
        }
    return {
        "action": "DECLINE", "suggested_limit": 0,
        "conditions": ["Share the improvement roadmap with the applicant",
                       "Re-assess after two clean quarters via consented refresh"],
        "rationale": (f"Repayment capacity does not support new debt: health score {score}, "
                      f"12-month stress probability {pd12:.0%}"
                      + (f", cumulative risk crossing 30% around {stress_out['first_breach_month']}"
                         if stress_out.get("first_breach_month") else "") + "."),
    }


def run_assessment(*, applicant: dict, application: dict, payloads: dict,
                   consents: list[dict]) -> dict:
    """payloads: {"AA": bank_payload, "GST": gst_payload, "EPFO": epfo_payload}
    (any subset — engines degrade gracefully)."""
    f = features.build_features(payloads.get("AA"), payloads.get("GST"), payloads.get("EPFO"))
    tri = triangulation.run(f, applicant["sector"])
    score_out = scoring.run(f, tri, application["amount_requested"], application["tenure_months"])
    stress_out = stress.run(f, scoring.emi_for(application["amount_requested"], application["tenure_months"]))
    recommendation = _recommend(
        f=f, score_out=score_out, tri=tri, stress_out=stress_out,
        product=application["product"], amount_requested=application["amount_requested"],
        tenure_months=application["tenure_months"],
    )
    memo_md, citations = memo.build(
        applicant=applicant, application=application, consents=consents,
        scoring=score_out, triangulation=tri, stress=stress_out,
        recommendation=recommendation,
    )
    return {
        "health_score": score_out["health_score"],
        "grade": score_out["grade"],
        "verification_index": tri["index"],
        "pd_12m": stress_out["pd_12m"],
        "risk_band": stress.risk_band(stress_out["pd_12m"]),
        "recommendation": recommendation,
        "pillars": score_out["pillars"],
        "triangulation": tri,
        "stress": stress_out,
        "memo_markdown": memo_md,
        "memo_citations": citations,
        "computed": score_out["computed"],
    }
