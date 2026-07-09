"""5-pillar health score (300–900) with reason-coded metrics.

Every pillar is a weighted blend of transparent metrics; every metric carries
its value, status and a plain-language explanation — the score is fully
auditable, which is what makes it usable inside a regulated underwriting
process (and defensible to a model-risk committee).
"""
from statistics import mean

from ..config import get_settings
from .features import Features, cv, linear_fit, piecewise

settings = get_settings()

GRADE_BANDS = [(800, "A+"), (750, "A"), (700, "B+"), (650, "B"), (550, "C"), (0, "D")]

RETAIL_AGGREGATES = {"UPI Collections", "Cash Deposit", "Retail Buyers"}


def emi_for(principal: float, tenure_months: int, annual_rate: float | None = None) -> float:
    r = (annual_rate or settings.lending_rate_annual) / 12
    if principal <= 0 or tenure_months <= 0:
        return 0.0
    factor = (1 + r) ** tenure_months
    return principal * r * factor / (factor - 1)


def principal_for(emi: float, tenure_months: int, annual_rate: float | None = None) -> float:
    r = (annual_rate or settings.lending_rate_annual) / 12
    if emi <= 0 or tenure_months <= 0:
        return 0.0
    factor = (1 + r) ** tenure_months
    return emi * (factor - 1) / (r * factor)


def _metric(key, label, value, unit, status, explanation, benchmark=None):
    return {"key": key, "label": label, "value": value, "unit": unit,
            "benchmark": benchmark, "status": status, "explanation": explanation}


def _status(score: float) -> str:
    return "good" if score >= 65 else ("warn" if score >= 40 else "bad")


def grade_for(score: int) -> str:
    for floor, grade in GRADE_BANDS:
        if score >= floor:
            return grade
    return "D"


def run(f: Features, triangulation: dict, amount_requested: int, tenure_months: int) -> dict:
    """Returns {"pillars": [...], "health_score": int, "grade": str, extras...}"""
    lakh = lambda v: f"₹{v / 100_000:.1f}L"
    pillars = []

    verified_annual = f.verified_annual_inflow
    declared_annual = f.gst_annual_declared
    haircut = f.inflow_haircut

    # ---- P1 Revenue Quality & Growth (25%) --------------------------------
    corrob = (min(declared_annual, verified_annual) / max(declared_annual, verified_annual)
              if declared_annual and verified_annual else 0.0)
    s_corrob = piecewise(corrob, [(0.4, 15), (0.6, 40), (0.8, 70), (0.95, 95)])

    des_inflow = f.deseasonalized(f.series("inflow"))
    n = len(des_inflow)
    growth = 0.0
    if n >= 13:
        first, last = mean(des_inflow[: n // 2]), mean(des_inflow[n // 2:])
        # annualised growth between the two halves of the history
        growth = (last / first - 1) * (12 / (n / 2)) if first else 0.0
    s_growth = piecewise(growth, [(-0.25, 8), (-0.05, 35), (0.0, 45), (0.15, 75), (0.35, 95)])

    _, slope, r2, _ = linear_fit(des_inflow)
    s_consist = piecewise(r2, [(0.0, 30), (0.3, 55), (0.7, 85), (0.9, 95)]) if n >= 6 else 40

    p1 = 0.4 * s_corrob + 0.35 * s_growth + 0.25 * s_consist
    pillars.append({
        "key": "revenue_quality", "label": "Revenue Quality & Growth",
        "score": round(p1), "weight": 0.25,
        "metrics": [
            _metric("verified_annual_revenue", "Verified annual revenue (banked, adjusted)",
                    int(verified_annual), "INR", _status(s_corrob),
                    f"Banked inflows annualise to {lakh(f.bank_annual_inflow)}; "
                    f"{haircut:.0%} discounted as circular/window-dressed → {lakh(verified_annual)} verified."),
            _metric("gst_corroboration", "GST↔bank corroboration", round(corrob, 2), "ratio", _status(s_corrob),
                    f"Declared ({lakh(declared_annual)}) and verified banked revenue agree at {corrob:.0%}."),
            _metric("revenue_growth", "Revenue growth (annualised)", round(growth, 3), "ratio", _status(s_growth),
                    f"Deseasonalised inflows are {'growing' if growth >= 0 else 'declining'} at {growth:+.0%}/yr."),
            _metric("trend_consistency", "Trend consistency (R²)", round(r2, 2), "score", _status(s_consist),
                    "How much of month-to-month movement is explained by the trend rather than noise."),
        ],
    })

    # ---- P2 Cash-Flow Stability (25%) ---------------------------------------
    des_net = f.deseasonalized([r.net for r in f.rows])
    stability_cv = cv(des_net)
    s_cv = piecewise(stability_cv, [(0.15, 95), (0.3, 75), (0.6, 45), (1.2, 10)])

    balances = [r.avg_balance for r in f.rows if r.avg_balance]
    outflows = [r.outflow for r in f.rows if r.outflow]
    buffer_days = (mean(balances) / (mean(outflows) / 30)) if balances and outflows else 0.0
    s_buffer = piecewise(buffer_days, [(3, 10), (7, 40), (15, 65), (30, 85), (60, 95)])

    nets = [r.net for r in f.rows]
    avg_net = mean(nets) if nets else 0.0
    worst3 = mean(sorted(nets)[:3]) if len(nets) >= 3 else avg_net
    trough = worst3 / avg_net if avg_net > 0 else -1.0
    s_trough = piecewise(trough, [(-1.0, 10), (0.0, 40), (0.5, 75), (0.8, 92)])

    p2 = 0.4 * s_cv + 0.35 * s_buffer + 0.25 * s_trough
    pillars.append({
        "key": "cashflow_stability", "label": "Cash-Flow Stability",
        "score": round(p2), "weight": 0.25,
        "metrics": [
            _metric("net_flow_cv", "Net-flow volatility (CV, deseasonalised)", round(stability_cv, 2), "ratio",
                    _status(s_cv), "Coefficient of variation of monthly net cash flow after removing seasonality."),
            _metric("buffer_days", "Liquidity buffer", round(buffer_days, 1), "days", _status(s_buffer),
                    f"Average balance covers {buffer_days:.0f} days of typical outflow."),
            _metric("trough_coverage", "Worst-quarter resilience", round(trough, 2), "ratio", _status(s_trough),
                    "Average of the three weakest months relative to the overall monthly average."),
        ],
    })

    # ---- P3 Obligations & Leverage (20%) ---------------------------------------
    proposed_emi = emi_for(amount_requested, tenure_months)
    existing_emi = f.avg_monthly_emi
    avg_available = mean([r.net + r.emi for r in f.rows[-12:]]) if f.rows else 0.0
    dscr = avg_available / (existing_emi + proposed_emi) if (existing_emi + proposed_emi) > 0 else 3.0
    s_dscr = piecewise(dscr, [(0.8, 8), (1.0, 20), (1.2, 50), (1.5, 75), (2.5, 95)])

    avg_inflow = mean([r.inflow for r in f.rows[-12:]]) if f.rows else 0.0
    foir = existing_emi / avg_inflow if avg_inflow else 0.0
    s_foir = piecewise(foir, [(0.0, 95), (0.1, 75), (0.25, 45), (0.4, 15)])

    bounces_12m = sum(r.bounces for r in f.rows[-12:])
    s_bounce = piecewise(bounces_12m, [(0, 95), (1, 55), (2, 35), (3, 10)])

    p3 = 0.5 * s_dscr + 0.25 * s_foir + 0.25 * s_bounce
    pillars.append({
        "key": "obligations_leverage", "label": "Obligations & Leverage",
        "score": round(p3), "weight": 0.20,
        "metrics": [
            _metric("dscr_proposed", "DSCR incl. proposed facility", round(dscr, 2), "x", _status(s_dscr),
                    f"Cash available for debt service ({lakh(avg_available)}/mo) vs total service "
                    f"({lakh(existing_emi + proposed_emi)}/mo incl. proposed EMI {lakh(proposed_emi)}).",
                    benchmark=1.4),
            _metric("existing_foir", "Existing obligation ratio", round(foir, 2), "ratio", _status(s_foir),
                    f"Current EMIs absorb {foir:.0%} of monthly inflows."),
            _metric("bounces_12m", "Payment returns (12m)", bounces_12m, "count", _status(s_bounce),
                    "Inward return/bounce incidents detected in the statement narration."),
        ],
    })

    # ---- P4 Compliance Discipline (15%) ------------------------------------------
    delays = [r.gst_delay for r in f.rows if r.gst_delay is not None]
    mean_delay = mean(delays) if delays else 30.0
    s_delay = piecewise(mean_delay, [(0, 95), (5, 75), (12, 45), (25, 15)])
    on_time = (sum(1 for d in delays if d <= 5) / len(delays)) if delays else 0.0
    s_ontime = piecewise(on_time, [(0.2, 15), (0.5, 40), (0.8, 70), (1.0, 95)])
    epfo_rows = [r.epfo_on_time for r in f.rows if r.epfo_on_time is not None]
    epfo_rate = (sum(1 for x in epfo_rows if x) / len(epfo_rows)) if epfo_rows else 0.5
    s_epfo = piecewise(epfo_rate, [(0.3, 20), (0.6, 45), (0.85, 75), (1.0, 95)])

    p4 = 0.4 * s_delay + 0.3 * s_ontime + 0.3 * s_epfo
    pillars.append({
        "key": "compliance_discipline", "label": "Compliance Discipline",
        "score": round(p4), "weight": 0.15,
        "metrics": [
            _metric("gst_mean_delay", "Mean GST filing delay", round(mean_delay, 1), "days", _status(s_delay),
                    "Average days past due across GSTR-3B filings in the history window."),
            _metric("gst_on_time_rate", "Filings on time (≤5d)", round(on_time, 2), "ratio", _status(s_ontime),
                    f"{on_time:.0%} of returns filed within five days of the due date."),
            _metric("epfo_punctuality", "EPFO deposit punctuality", round(epfo_rate, 2), "ratio", _status(s_epfo),
                    "Share of months with provident-fund contributions deposited on time."),
        ],
    })

    # ---- P5 Counterparty & Concentration (15%) --------------------------------------
    named = {cp: v for cp, v in f.counterparty_credits.items() if cp not in RETAIL_AGGREGATES}
    total_cr = sum(f.counterparty_credits.values()) or 1.0
    shares = sorted((v / total_cr for v in named.values()), reverse=True)
    top1 = shares[0] if shares else 0.0
    hhi = sum(s * s for s in shares)
    s_top1 = piecewise(top1, [(0.15, 90), (0.3, 70), (0.5, 40), (0.7, 15)])
    s_hhi = piecewise(hhi, [(0.05, 90), (0.15, 65), (0.3, 40), (0.5, 15)])
    retail_share = 1 - sum(shares)
    s_retail = piecewise(retail_share, [(0.0, 50), (0.4, 70), (0.8, 90)])

    p5 = 0.5 * s_top1 + 0.3 * s_hhi + 0.2 * s_retail
    pillars.append({
        "key": "counterparty_concentration", "label": "Counterparty & Concentration",
        "score": round(p5), "weight": 0.15,
        "metrics": [
            _metric("top1_share", "Largest counterparty share", round(top1, 2), "ratio", _status(s_top1),
                    f"The single largest named buyer contributes {top1:.0%} of inflows."),
            _metric("hhi", "Concentration (HHI)", round(hhi, 3), "index", _status(s_hhi),
                    "Herfindahl index over named counterparties; lower is more diversified."),
            _metric("retail_share", "Diversified retail share", round(retail_share, 2), "ratio", _status(s_retail),
                    f"{retail_share:.0%} of inflows come from many small UPI/cash customers."),
        ],
    })

    # ---- composite + gates ------------------------------------------------------------
    composite = sum(p["score"] * p["weight"] for p in pillars)
    score = round(300 + 6 * composite)

    gates: list[str] = []
    has_critical = any(fl["severity"] == "critical" for fl in triangulation["fraud_flags"])
    v_index = triangulation["index"]
    if has_critical:
        score, capped = min(score, 480), True
        gates.append("Critical fraud flag: score capped at 480 (grade D) regardless of pillar performance.")
    if v_index < 40:
        score = min(score, 480)
        gates.append("Verification index below 40: data cannot be trusted; score capped at 480.")
    elif v_index < 60:
        score = min(score, 620)
        gates.append("Verification index below 60: score capped at 620 pending better data.")

    return {
        "pillars": pillars,
        "health_score": score,
        "grade": grade_for(score),
        "gates": gates,
        "computed": {
            "verified_annual_revenue": int(verified_annual),
            "declared_annual_revenue": int(declared_annual),
            "avg_available_monthly": int(avg_available),
            "existing_emi_monthly": int(existing_emi),
            "proposed_emi_monthly": int(proposed_emi),
            "dscr_proposed": round(dscr, 2),
            "growth_annualised": round(growth, 3),
            "buffer_days": round(buffer_days, 1),
            "bounces_12m": bounces_12m,
        },
    }
