"""Borrower-facing Health Card: the assessment translated into plain
language, plus the improvement roadmap that turns a rejection into a
pipeline — the applicant leaves with actions, estimated score impact and a
re-review date instead of a dead end."""
import hashlib
from datetime import datetime, timedelta

from .scoring import emi_for

PILLAR_STRENGTH_COPY = {
    "revenue_quality": "Revenue is verified and growing",
    "cashflow_stability": "Cash flows are steady and predictable",
    "obligations_leverage": "Debt obligations are comfortably covered",
    "compliance_discipline": "Filings and statutory payments are disciplined",
    "counterparty_concentration": "Income comes from a healthy spread of customers",
}
PILLAR_WATCHOUT_COPY = {
    "revenue_quality": "Revenue trend needs attention",
    "cashflow_stability": "Cash flows swing sharply month to month",
    "obligations_leverage": "Existing obligations leave little headroom",
    "compliance_discipline": "Filing discipline is inconsistent",
    "counterparty_concentration": "Too much income depends on few customers",
}

# metric key → (action, why, timeframe_months)
ROADMAP_RULES = {
    "gst_corroboration": ("Route all sales through your business current account and declare full turnover in GSTR-3B",
                          "Matching filings and bank inflows is the single biggest driver of a verified score.", 6),
    "gst_mean_delay": ("File GSTR-3B by the due date every month for the next two quarters",
                       "Filing punctuality feeds your Compliance pillar directly.", 6),
    "gst_on_time_rate": ("File GSTR-3B by the due date every month for the next two quarters",
                         "Filing punctuality feeds your Compliance pillar directly.", 6),
    "bounces_12m": ("Keep sufficient balance on EMI dates — six clean months removes this drag",
                    "Payment returns are a strong early-warning signal for lenders.", 6),
    "top1_share": ("Add at least two recurring buyers to reduce dependence on your largest customer",
                   "Concentrated income makes cash flows fragile if one buyer delays.", 9),
    "hhi": ("Broaden your customer base with recurring smaller buyers",
            "A diversified inflow mix strengthens the Concentration pillar.", 9),
    "buffer_days": ("Build a cash buffer covering at least 15 days of outflows",
                    "A liquidity cushion absorbs lean months without missing obligations.", 6),
    "epfo_punctuality": ("Deposit EPFO contributions on time (and register all eligible staff)",
                         "Verified payroll corroborates your business scale to lenders.", 6),
    "dscr_proposed": ("Reduce or refinance existing EMIs before taking on new debt",
                      "Freeing monthly cash flow raises the amount you qualify for.", 12),
    "net_flow_cv": ("Smooth large supplier payments across the month where possible",
                    "Less volatile cash flow lifts your Stability pillar.", 6),
}


def _impact(pillar: dict) -> int:
    """Estimated score gain if this pillar's weak metrics are fixed —
    proportional to the pillar's weight and its distance from a 'good' 70."""
    gain = pillar["weight"] * max(0, 70 - pillar["score"]) * 6 * 0.6
    return max(5, min(25, round(gain)))


def build(*, applicant: dict, application: dict, assessment: dict) -> dict:
    pillars = assessment["pillars"]
    tri = assessment["triangulation"]
    stress = assessment["stress"]
    rec = assessment["recommendation"]
    score, grade = assessment["health_score"], assessment["grade"]

    has_critical = any(fl["severity"] == "critical" for fl in tri["fraud_flags"])
    vidx = assessment["verification_index"]
    badge = ("VERIFICATION_FAILED" if has_critical
             else "VERIFIED" if vidx >= 80 else "PARTIALLY_VERIFIED")

    # ---- summary -----------------------------------------------------------
    tone = {"A+": "excellent", "A": "excellent", "B+": "strong", "B": "sound",
            "C": "developing", "D": "strained"}[grade]
    pd12 = stress["pd_12m"]
    if badge == "VERIFICATION_FAILED":
        summary = (f"{applicant['business_name']} could not be verified: the declared scale of the "
                   "business is not supported by its banked cash flows. Offers are paused until the "
                   "verification issues below are resolved with documentary evidence.")
    else:
        gst_ok = next(c for c in tri["checks"] if c["key"] == "gst_vs_bank")["status"] == "PASS"
        verified_phrase = ("fully corroborated across GST, bank and payroll data" if vidx >= 80 and gst_ok
                           else "largely corroborated, with gaps noted below" if vidx >= 80
                           else "partially corroborated — some sources could not be matched")
        outlook = ("a stable 12-month outlook" if pd12 < 0.08
                   else "a broadly manageable 12-month outlook" if pd12 < 0.2
                   else "signs of stress building over the next 12 months")
        summary = (f"{applicant['business_name']} shows {tone} financial health "
                   f"(score {score}/900, grade {grade}). Cash flows are {verified_phrase}, with {outlook}.")

    # ---- strengths / watchouts ----------------------------------------------
    strengths, watchouts = [], []
    for p in sorted(pillars, key=lambda x: -x["score"]):
        if p["score"] >= 70 and len(strengths) < 3:
            strengths.append({"title": PILLAR_STRENGTH_COPY[p["key"]],
                              "detail": f"{p['label']} scores {p['score']}/100."})
    gst_check = next(c for c in tri["checks"] if c["key"] == "gst_vs_bank")
    if gst_check["status"] == "PASS" and len(strengths) < 4:
        strengths.append({"title": "Verified turnover", "detail": gst_check["explanation"]})

    for p in sorted(pillars, key=lambda x: x["score"]):
        if p["score"] < 55 and len(watchouts) < 3:
            watchouts.append({"title": PILLAR_WATCHOUT_COPY[p["key"]],
                              "detail": f"{p['label']} scores {p['score']}/100."})
    for s in stress.get("ews_signals", [])[:2]:
        watchouts.append({"title": s["label"], "detail": s["evidence"]})
    if badge == "VERIFICATION_FAILED":
        watchouts = ([{"title": f"Verification failed — {fl['code'].replace('_', ' ').title()}",
                       "detail": fl["description"]}
                      for fl in tri["fraud_flags"]] + watchouts)[:4]

    # ---- roadmap ---------------------------------------------------------------
    pillar_by_key = {p["key"]: p for p in pillars}
    roadmap, seen_actions = [], set()
    for p in sorted(pillars, key=lambda x: x["score"]):
        for m in p["metrics"]:
            rule = ROADMAP_RULES.get(m["key"])
            if rule and m["status"] in ("warn", "bad") and rule[0] not in seen_actions:
                seen_actions.add(rule[0])
                roadmap.append({"action": rule[0], "why": rule[1],
                                "impact_points": _impact(pillar_by_key[p["key"]]),
                                "timeframe_months": rule[2]})
    if gst_check["status"] == "WARN" and not any("GSTR-3B" in r["action"] or "current account" in r["action"]
                                                 for r in roadmap):
        roadmap.insert(0, {"action": ROADMAP_RULES["gst_corroboration"][0],
                           "why": ROADMAP_RULES["gst_corroboration"][1],
                           "impact_points": _impact(pillar_by_key["revenue_quality"]),
                           "timeframe_months": 6})
    roadmap = roadmap[:5]

    # ---- offer -------------------------------------------------------------------
    offer = None
    if rec["action"] in ("APPROVE", "APPROVE_CONDITIONAL") and rec.get("suggested_limit"):
        limit = rec["suggested_limit"]
        tenure = application["tenure_months"]
        offer = {"product": application["product"], "limit": limit,
                 "indicative_emi": round(emi_for(limit, tenure)),
                 "tenure_months": tenure}

    created = datetime.fromisoformat(assessment["created_at"])
    review_days = 60 if rec["action"] in ("DECLINE", "REFER") else 90
    card_id = "PRKC-" + hashlib.sha256(
        f"{assessment['id']}:{score}".encode()).hexdigest()[:8]

    return {
        "ref": application["ref"],
        "business_name": applicant["business_name"],
        "generated_at": assessment["created_at"],
        "engine_version": assessment["engine_version"],
        "score": score, "grade": grade, "verification_index": vidx,
        "badge": badge,
        "summary": summary,
        "strengths": strengths,
        "watchouts": watchouts,
        "pillars": [{"key": p["key"], "label": p["label"], "score": p["score"],
                     "status": "good" if p["score"] >= 65 else "warn" if p["score"] >= 40 else "bad"}
                    for p in pillars],
        "eligible_offer": offer,
        "roadmap": roadmap,
        "next_review_date": (created + timedelta(days=review_days)).date().isoformat(),
        "card_id": card_id,
        "issued_by": "Parakh · IDBI Innovate 2026 sandbox",
    }
