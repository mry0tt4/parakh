"""Triangulation engine: cross-verify GST ↔ bank ↔ EPFO.

The core question a credit officer cannot answer from any single source:
"is this business's claimed scale real?" Each check returns PASS/WARN/FAIL
with the metric values and a plain-language explanation; failures emit
fraud flags. The composite verification index (0–100) gates the health
score downstream.
"""
from statistics import mean

from .features import Features

# revenue-per-employee plausibility bands, ₹/employee/year (synthetic
# benchmarks — production would load these from bureau/sector studies)
SECTOR_REV_PER_EMP = {
    "Retail Trade": (500_000, 8_000_000),
    "Wholesale Trade": (1_000_000, 5_000_000),
    "Food Products Manufacturing": (400_000, 3_000_000),
    "IT & Professional Services": (800_000, 6_000_000),
    "Auto Components Manufacturing": (500_000, 4_000_000),
    "FMCG / D2C": (300_000, 5_000_000),
}
DEFAULT_BAND = (300_000, 8_000_000)

SEVERITY = {
    "gst_vs_bank": "high",
    "payroll_plausibility": "high",
    "circular_flows": "high",
    "window_dressing": "medium",
    "balance_consistency": "medium",
    "filing_vs_cash": "medium",
}
DEDUCTION = {("FAIL", "high"): 22, ("FAIL", "medium"): 15,
             ("WARN", "high"): 8, ("WARN", "medium"): 5}


def _check(key: str, label: str, status: str, metrics: dict, explanation: str) -> dict:
    return {"key": key, "label": label, "status": status,
            "severity": SEVERITY[key], "metrics": metrics, "explanation": explanation}


def run(f: Features, sector: str) -> dict:
    checks: list[dict] = []
    flags: list[dict] = []
    lakh = lambda v: f"₹{v / 100_000:.1f}L"

    # 1. GST-declared turnover vs banked inflows -----------------------------
    declared, banked = f.gst_annual_declared, f.bank_annual_inflow
    ratio = declared / banked if banked else 0.0
    in_band = 0
    for r in f.rows:
        if r.gst_turnover and r.inflow:
            if 0.8 <= r.gst_turnover / r.inflow <= 1.2:
                in_band += 1
    if declared == 0:
        status, expl = "WARN", ("No GST returns available — declared turnover cannot be "
                                "corroborated against banked inflows. Obtain GST consent to lift this check.")
    elif 0.8 <= ratio <= 1.2:
        status, expl = "PASS", (
            f"Declared turnover ({lakh(declared)}/yr) matches banked inflows "
            f"({lakh(banked)}/yr) within tolerance; {in_band} months inside the 0.8–1.2 band.")
    elif ratio > 1.35:
        status = "FAIL"
        expl = (f"Declared turnover ({lakh(declared)}/yr) is {ratio:.1f}× banked inflows "
                f"({lakh(banked)}/yr) — the bank account does not support the claimed scale.")
        if ratio > 1.5:
            flags.append({"code": "TURNOVER_INFLATION", "severity": "critical",
                          "description": f"GST-declared turnover is {ratio:.1f}× actual banked inflows — "
                                         "pattern consistent with turnover inflation for credit shopping."})
    elif ratio > 1.2:
        status, expl = "WARN", (f"Declared turnover runs {ratio:.2f}× banked inflows; part of sales may be "
                                "settled outside this account — obtain other-bank statements via AA.")
    elif ratio >= 0.6:
        status, expl = "WARN", (
            f"Banked inflows ({lakh(banked)}/yr) exceed declared turnover ({lakh(declared)}/yr, ratio {ratio:.2f}). "
            "Typical of cash-economy under-declaration: real capacity is likely higher than filings show, "
            "but compliance risk must be priced.")
    else:
        status, expl = "FAIL", (f"Declared turnover is only {ratio:.2f}× of banked inflows — "
                                "filings are not a usable representation of this business.")
    checks.append(_check("gst_vs_bank", "GST turnover vs bank inflows", status,
                         {"ratio_ttm": round(ratio, 2), "declared_annual": int(declared),
                          "banked_annual": int(banked), "months_in_band": in_band}, expl))

    # 2. Payroll plausibility (EPFO) ------------------------------------------
    emp_rows = [r.employees for r in f.rows if r.employees]
    if not emp_rows:
        checks.append(_check("payroll_plausibility", "Workforce vs claimed scale", "WARN",
                             {"employees_avg": 0},
                             "No EPFO records available — workforce cannot corroborate claimed scale."))
    else:
        emp_avg = mean(emp_rows)
        rpe = declared / emp_avg if emp_avg else 0
        lo, hi = SECTOR_REV_PER_EMP.get(sector, DEFAULT_BAND)
        metrics = {"employees_avg": round(emp_avg, 1), "revenue_per_employee": int(rpe),
                   "sector_band_low": lo, "sector_band_high": hi}
        if rpe > hi:
            status = "FAIL"
            expl = (f"Declared turnover implies {lakh(rpe)}/employee/yr against a sector ceiling of "
                    f"{lakh(hi)} — a {emp_avg:.0f}-person establishment does not plausibly produce the claimed scale.")
            if rpe > 1.5 * hi:
                flags.append({"code": "PAYROLL_MISMATCH", "severity": "high",
                              "description": "EPFO workforce is far too small for the declared turnover."})
        elif rpe < lo:
            status, expl = "WARN", (f"Revenue per employee ({lakh(rpe)}) is below the sector band — "
                                    "either over-staffing or under-declared revenue.")
        else:
            status, expl = "PASS", (f"{emp_avg:.0f} EPFO-registered employees support the declared scale "
                                    f"({lakh(rpe)}/employee/yr, within sector band).")
        checks.append(_check("payroll_plausibility", "Workforce vs claimed scale", status, metrics, expl))

    # 3. Circular flows --------------------------------------------------------
    circ_ratio = f.circular_amount / f.total_credit if f.total_credit else 0.0
    metrics = {"circular_value": int(f.circular_amount), "share_of_inflows": round(circ_ratio, 3)}
    if circ_ratio > 0.15:
        status = "FAIL"
        expl = (f"{circ_ratio:.0%} of inflows return to the same counterparties they came from — "
                "round-tripping that manufactures apparent turnover.")
        flags.append({"code": "CIRCULAR_FLOW", "severity": "critical",
                      "description": f"{circ_ratio:.0%} of credited value flows back to the same "
                                     "counterparties within the statement period."})
    elif circ_ratio > 0.08:
        status, expl = "WARN", (f"{circ_ratio:.0%} of inflows cycle back to source counterparties — "
                                "verify trade genuineness with invoices.")
    else:
        status, expl = "PASS", "No material round-tripping between inflow and outflow counterparties."
    checks.append(_check("circular_flows", "Circular fund flows", status, metrics, expl))

    # 4. Window dressing --------------------------------------------------------
    wd_ratio = f.round_eom_credit / f.total_credit if f.total_credit else 0.0
    metrics = {"round_eom_value": int(f.round_eom_credit), "share_of_inflows": round(wd_ratio, 3)}
    if wd_ratio > 0.15:
        status = "FAIL"
        expl = (f"{wd_ratio:.0%} of credit value arrives as round amounts in the last days of the month — "
                "classic balance window-dressing ahead of a loan application.")
        flags.append({"code": "WINDOW_DRESSING", "severity": "high",
                      "description": "Month-end round-figure credits inflate apparent activity."})
    elif wd_ratio > 0.05:
        status, expl = "WARN", (f"{wd_ratio:.0%} of credits are round month-end amounts — review the underlying invoices.")
    else:
        status, expl = "PASS", "Credit timing and ticket sizes look organic; no month-end clustering of round amounts."
    checks.append(_check("window_dressing", "Month-end window dressing", status, metrics, expl))

    # 5. Balance consistency ------------------------------------------------------
    balances = [r.avg_balance for r in f.rows if r.avg_balance]
    outflows = [r.outflow for r in f.rows if r.outflow]
    buffer_days = (mean(balances) / (mean(outflows) / 30)) if balances and outflows else 0.0
    metrics = {"avg_balance": int(mean(balances)) if balances else 0, "buffer_days": round(buffer_days, 1)}
    if buffer_days < 3:
        status, expl = "FAIL", (f"Average balance covers only {buffer_days:.1f} days of outflow — "
                                "the account runs empty between cycles.")
    elif buffer_days < 7:
        status, expl = "WARN", (f"Thin liquidity buffer: {buffer_days:.1f} days of outflow cover.")
    else:
        status, expl = "PASS", f"Average balances hold {buffer_days:.0f} days of outflow cover — consistent with claimed operations."
    checks.append(_check("balance_consistency", "Balance vs operating scale", status, metrics, expl))

    # 6. Filing discipline vs cash position ------------------------------------------
    delays = [r.gst_delay for r in f.rows if r.gst_delay is not None]
    if len(delays) >= 12:
        early, late = mean(delays[:6]), mean(delays[-6:])
        drift = late - early
    else:
        early = late = mean(delays) if delays else 0.0
        drift = 0.0
    metrics = {"mean_delay_days": round(mean(delays), 1) if delays else 0,
               "recent_delay_days": round(late, 1), "drift_days": round(drift, 1)}
    if drift > 8:
        status, expl = "FAIL", (f"GST filing delay drifted from {early:.0f} to {late:.0f} days — "
                                "deteriorating discipline usually tracks cash stress.")
    elif drift > 4:
        status, expl = "WARN", f"Filing delays are lengthening (+{drift:.0f} days over the period)."
    else:
        status, expl = "PASS", f"Filing cadence is steady (mean delay {metrics['mean_delay_days']} days)."
    checks.append(_check("filing_vs_cash", "Filing discipline trend", status, metrics, expl))

    # composite index ---------------------------------------------------------------
    index = 100
    for c in checks:
        index -= DEDUCTION.get((c["status"], c["severity"]), 0)
    index = max(0, min(100, index))

    return {"index": index, "checks": checks, "fraud_flags": flags}
