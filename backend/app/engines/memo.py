"""Credit assessment memo generator.

Deterministic: the memo is assembled from engine outputs with every figure
tagged to its data source, so a reviewer can trace any number back to the
consented pull that produced it. (An optional LLM pass could polish prose in
production; determinism is a feature for audits and for tests.)
"""
from datetime import datetime, timezone


def _inr(v: float) -> str:
    v = float(v)
    if abs(v) >= 1e7:
        return f"₹{v / 1e7:.2f} Cr"
    if abs(v) >= 1e5:
        return f"₹{v / 1e5:.1f} L"
    return f"₹{v:,.0f}"


ACTION_LABELS = {
    "APPROVE": "Approve at requested terms",
    "APPROVE_CONDITIONAL": "Approve with conditions (right-sized limit)",
    "REFER": "Refer to risk committee",
    "DECLINE": "Decline",
}


def build(*, applicant: dict, application: dict, consents: list[dict],
          scoring: dict, triangulation: dict, stress: dict,
          recommendation: dict) -> tuple[str, list[dict]]:
    citations = [
        {"tag": "S1", "source": "AA bank statement pull",
         "description": "Consented Account Aggregator statement data (transactions, balances)"},
        {"tag": "S2", "source": "GST returns (GSP)",
         "description": "GSTR-3B summaries fetched with taxpayer consent"},
        {"tag": "S3", "source": "EPFO establishment records",
         "description": "Employee counts and contribution punctuality"},
        {"tag": "S4", "source": "Parakh engine v" + application.get("engine_version", "1.0.0"),
         "description": "Derived metrics: triangulation, health score, stress projection"},
    ]
    c = scoring["computed"]
    now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

    lines: list[str] = []
    add = lines.append

    add(f"# Credit Assessment Memo — {application['ref']}")
    add("")
    add(f"*Generated {now} · Engine v{application.get('engine_version', '1.0.0')} · "
        f"Health Score **{scoring['health_score']} ({scoring['grade']})** · "
        f"Verification Index **{triangulation['index']}/100** · "
        f"12-month stress probability **{stress['pd_12m']:.0%}***")
    add("")

    add("## 1. Business profile")
    add(f"**{applicant['business_name']}** — {applicant['sector']}, {applicant['entity_type'].replace('_', ' ')}, "
        f"{applicant['city']}, {applicant['state']}. GSTIN {applicant['gstin_masked']} "
        f"(registered {applicant['incorporation_date']}).")
    tags = []
    if applicant.get("is_ntc"):
        tags.append("**New-to-Credit** — no formal borrowing history")
    if applicant.get("is_ntb"):
        tags.append("**New-to-Bank**")
    if tags:
        add("Classification: " + "; ".join(tags) + ".")
    add("")

    add("## 2. Requested facility")
    add(f"{application['product'].replace('_', ' ').title()} of **{_inr(application['amount_requested'])}** "
        f"for {application['tenure_months']} months. Purpose: {application.get('purpose') or '—'}.")
    add("")

    add("## 3. Data sources & consent")
    add("| Source | Artefact | Window | Records |")
    add("|---|---|---|---|")
    for cn in consents:
        dp = cn.get("data_pull") or {}
        add(f"| {cn['source']} | `{cn['artefact_id']}` | {cn['data_from']} → {cn['data_to']} "
            f"| {dp.get('record_count', '—')} |")
    add("")
    add("All pulls are purpose-bound (consent purpose code 101 — credit underwriting), "
        "time-bound and hash-verified. [S1][S2][S3]")
    add("")

    add("## 4. Verified financial position")
    add(f"- Banked inflows annualise to **{_inr(c['verified_annual_revenue'])}** "
        f"after discounting non-organic credits. [S1][S4]")
    add(f"- GST-declared turnover: **{_inr(c['declared_annual_revenue'])}**/yr. [S2]")
    add(f"- Cash available for debt service: **{_inr(c['avg_available_monthly'])}**/month; existing obligations "
        f"**{_inr(c['existing_emi_monthly'])}**/month; proposed EMI **{_inr(c['proposed_emi_monthly'])}**/month "
        f"→ DSCR **{c['dscr_proposed']}×** (target ≥ 1.4×). [S1][S4]")
    add(f"- Revenue trajectory: **{c['growth_annualised']:+.0%}** annualised; liquidity buffer "
        f"**{c['buffer_days']} days** of outflow cover. [S1][S4]")
    add("")

    add("## 5. Triangulation & verification")
    add(f"Verification index: **{triangulation['index']}/100**.")
    add("")
    add("| Check | Result | Finding |")
    add("|---|---|---|")
    for chk in triangulation["checks"]:
        add(f"| {chk['label']} | **{chk['status']}** | {chk['explanation']} |")
    add("")
    if triangulation["fraud_flags"]:
        add("### ⚠ Fraud indicators")
        for fl in triangulation["fraud_flags"]:
            add(f"- **{fl['code']}** ({fl['severity']}): {fl['description']}")
        add("")

    add("## 6. Health score")
    add(f"Composite **{scoring['health_score']} / 900 — grade {scoring['grade']}**. [S4]")
    add("")
    add("| Pillar | Weight | Score |")
    add("|---|---|---|")
    for p in scoring["pillars"]:
        add(f"| {p['label']} | {p['weight']:.0%} | {p['score']}/100 |")
    add("")
    for gate in scoring.get("gates", []):
        add(f"> **Gate applied:** {gate}")
    if scoring.get("gates"):
        add("")

    add("## 7. Forward stress outlook (12 months)")
    add(f"Cumulative stress probability at 12 months: **{stress['pd_12m']:.0%}** "
        f"({risk_label(stress['pd_12m'])} band). "
        + (f"Cumulative risk crosses 30% around **{stress['first_breach_month']}**. "
           if stress['first_breach_month'] else "No 30% breach inside the horizon. ") + "[S4]")
    add("")
    for d in stress["drivers"]:
        add(f"- *{d['factor'].replace('_', ' ')}* ({d['impact']}): {d['description']}")
    if stress["ews_signals"]:
        add("")
        add("Early-warning signals:")
        for s in stress["ews_signals"]:
            add(f"- **{s['code']}** ({s['severity']}): {s['evidence']}")
    add("")

    add("## 8. Recommendation")
    add(f"**{ACTION_LABELS.get(recommendation['action'], recommendation['action'])}**"
        + (f" — suggested limit **{_inr(recommendation['suggested_limit'])}**"
           if recommendation.get("suggested_limit") else "") + ".")
    add("")
    add(recommendation["rationale"])
    if recommendation.get("conditions"):
        add("")
        add("Conditions / covenants:")
        for cond in recommendation["conditions"]:
            add(f"1. {cond}")
    add("")
    add("---")
    add("*Prepared by the Parakh assessment engine for officer review. This memo is a decision aid; "
        "the sanctioning authority remains responsible for the final credit decision.*")

    return "\n".join(lines), citations


def risk_label(pd: float) -> str:
    if pd < 0.08:
        return "Low"
    if pd < 0.20:
        return "Moderate"
    if pd < 0.40:
        return "Elevated"
    return "High"
