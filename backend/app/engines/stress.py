"""Forward stress engine: 12-month probability-of-stress curve.

Method (deliberately transparent — no black box):
1. Take historical monthly cash available for debt service (net flow with
   existing EMIs added back), deseasonalise, fit a linear trend; residual σ
   gives the monthly shock size.
2. Project 12 months forward with seasonality re-applied (P50 path; the P10
   band uses the 3-month-sustained downside, σ/√3).
3. Stress is modelled as *liquidity-buffer depletion*, not one bad month:
   the cash cushion (recent average balance) evolves as a random walk with
   drift = projected surplus after debt service. Cumulative stress
   probability at month m is the first-passage probability of the buffer
   crossing zero; the monthly curve is its hazard increment. A single noisy
   month therefore does not read as default — a sustained shortfall does.
4. Surface named drivers and RBI-EWS-style early-warning signals so the
   output is actionable, not just a number.
"""
import math
from statistics import mean

from .features import Features, linear_fit

PD_BANDS = [(0.08, "Low"), (0.20, "Moderate"), (0.40, "Elevated"), (1.01, "High")]


def _phi(z: float) -> float:
    """Logistic approximation of the standard normal CDF."""
    return 1 / (1 + math.exp(-1.702 * max(-8.0, min(8.0, z))))


def _forward_months(last_month: str, n: int = 12) -> list[str]:
    y, m = int(last_month[:4]), int(last_month[5:7])
    out = []
    for _ in range(n):
        m += 1
        if m == 13:
            y, m = y + 1, 1
        out.append(f"{y:04d}-{m:02d}")
    return out


def risk_band(pd: float) -> str:
    for ceiling, band in PD_BANDS:
        if pd < ceiling:
            return band
    return "High"


def run(f: Features, proposed_emi: float) -> dict:
    available = [r.net + r.emi for r in f.rows]
    existing_emi = f.avg_monthly_emi
    service = existing_emi + proposed_emi
    des = f.deseasonalized(available)
    a, b, _, sigma = linear_fit(des)
    base = mean([abs(v) for v in available]) or 1.0
    sigma = max(sigma, 0.08 * base)

    # liquidity cushion available to absorb shortfall months
    balances = [r.avg_balance for r in f.rows if r.avg_balance]
    buffer0 = mean(balances[-3:]) if balances else 0.0

    n = len(des)
    curve = []
    cumulative_prev = 0.0
    cum_drift = 0.0
    first_breach = None
    for i, month in enumerate(_forward_months(f.rows[-1].month), start=0):
        t = n + i
        m_num = int(month[5:7])
        season = f.seasonal_index.get(m_num, 1.0)
        proj = (a + b * t) * season
        p10 = proj - 1.2816 * sigma / math.sqrt(3)  # 3-month-sustained downside
        dscr_p50 = proj / service if service > 0 else 9.99
        dscr_p10 = p10 / service if service > 0 else 9.99

        # buffer random walk: drift = projected surplus after debt service
        cum_drift += proj - service
        walk_sigma = sigma * math.sqrt(i + 1)
        breach_z = (-(buffer0 + cum_drift)) / walk_sigma
        cumulative = min(0.99, max(cumulative_prev, _phi(breach_z)))
        p = cumulative - cumulative_prev  # hazard: P(first breach this month)
        cumulative_prev = cumulative
        if first_breach is None and cumulative >= 0.30:
            first_breach = month
        curve.append({
            "month": month,
            "dscr_p50": round(max(dscr_p50, -1.0), 2),
            "dscr_p10": round(max(dscr_p10, -1.0), 2),
            "stress_prob": round(p, 4),
            "cumulative_prob": round(cumulative, 4),
        })

    pd_12m = curve[-1]["cumulative_prob"]

    # ---- drivers -----------------------------------------------------------
    drivers = []
    avg_avail = mean(available) if available else 0.0
    annual_drift = b * 12
    if avg_avail > 0 and annual_drift < -0.10 * avg_avail:
        impact = "high" if annual_drift < -0.25 * avg_avail else "medium"
        drivers.append({"factor": "declining_trend", "impact": impact,
                        "description": f"Cash available for debt service is trending down "
                                       f"{annual_drift / avg_avail:+.0%} per year."})
    min_season = min(f.seasonal_index.values()) if f.seasonal_index else 1.0
    if min_season < 0.75:
        drivers.append({"factor": "seasonality_trough", "impact": "medium",
                        "description": f"Seasonal trough months run at {min_season:.0%} of average inflow, "
                                       "compressing DSCR in the lean quarter."})
    if service > 0 and proposed_emi / service > 0.5:
        drivers.append({"factor": "obligation_step_up", "impact": "medium",
                        "description": f"The proposed facility {proposed_emi / service:.0%} of total debt service — "
                                       "repayment capacity has no track record at this level."})
    if avg_avail > 0 and sigma / avg_avail > 0.4:
        drivers.append({"factor": "cashflow_volatility", "impact": "medium",
                        "description": "High month-to-month volatility widens the downside band."})
    if not drivers:
        drivers.append({"factor": "stable_outlook", "impact": "low",
                        "description": "No dominant stress driver; projected DSCR holds above 1 across the horizon."})

    # ---- early-warning signals ----------------------------------------------
    signals = []
    recent_bounces = sum(r.bounces for r in f.rows[-6:])
    if recent_bounces:
        signals.append({"code": "EWS_BOUNCE", "label": "Payment returns",
                        "severity": "high" if recent_bounces >= 2 else "medium",
                        "evidence": f"{recent_bounces} inward return incident(s) in the last 6 months."})
    delays = [r.gst_delay for r in f.rows if r.gst_delay is not None]
    if len(delays) >= 12:
        drift = mean(delays[-6:]) - mean(delays[:6])
        if drift > 4:
            signals.append({"code": "EWS_GST_DELAY", "label": "GST filing delays increasing",
                            "severity": "high" if drift > 8 else "medium",
                            "evidence": f"Mean filing delay rose from {mean(delays[:6]):.0f} to "
                                        f"{mean(delays[-6:]):.0f} days."})
    inflows = [r.inflow for r in f.rows]
    if len(inflows) >= 4 and all(inflows[i] > inflows[i + 1] for i in range(len(inflows) - 4, len(inflows) - 1)):
        signals.append({"code": "EWS_CREDIT_DECLINE", "label": "Credits declining consecutively",
                        "severity": "medium",
                        "evidence": "Monthly credit turnover fell in each of the last three months."})
    balances = [r.avg_balance for r in f.rows if r.avg_balance]
    if len(balances) >= 12 and mean(balances[-3:]) < 0.6 * mean(balances[:3]):
        signals.append({"code": "EWS_BALANCE_EROSION", "label": "Balance erosion",
                        "severity": "high",
                        "evidence": "Average balances are down more than 40% versus the start of the period."})
    emps = [r.employees for r in f.rows if r.employees]
    if len(emps) >= 12 and emps[-1] < 0.9 * emps[0]:
        signals.append({"code": "EWS_HEADCOUNT_DROP", "label": "Workforce shrinking",
                        "severity": "medium",
                        "evidence": f"EPFO headcount down from {emps[0]} to {emps[-1]} over the period."})

    return {
        "pd_12m": pd_12m,
        "first_breach_month": first_breach,
        "curve": curve,
        "drivers": drivers,
        "ews_signals": signals,
    }
