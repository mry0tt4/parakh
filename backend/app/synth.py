"""Synthetic MSME data generation.

Produces the three payloads a production deployment would obtain from real
rails — AA bank statements, GST returns (via GSP), EPFO contributions —
for six hand-crafted demo personas plus procedurally generated ones for any
applicant created at runtime.

Everything is seeded per persona, so scores, memos and tests are fully
reproducible run to run.
"""
import random
from dataclasses import dataclass, field
from datetime import date, timedelta

from .config import get_settings

settings = get_settings()


# --------------------------------------------------------------------------
# Persona definition
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Persona:
    key: str
    business_name: str
    gstin: str
    pan: str
    sector: str
    entity_type: str
    city: str
    state: str
    incorporation_date: str
    is_ntc: bool
    is_ntb: bool
    # generation parameters
    base_monthly_revenue: int
    annual_growth: float
    seasonality: tuple  # 12 multipliers, Jan..Dec
    gst_declared_ratio: float      # declared turnover / banked revenue
    channel_mix: dict              # UPI / NEFT / IMPS / CASH shares of credits
    margin: float                  # net cash margin before debt service
    employees: int
    employee_trend: float          # annual headcount change rate
    avg_wage: int
    epfo_on_time_rate: float
    existing_emis: tuple           # ((lender narration, monthly amount), ...)
    bounce_months_ago: tuple       # months-before-anchor with return incidents
    gst_delay_base: float          # mean filing delay (days) at series start
    gst_delay_trend: float         # extra delay days added per month
    circular_share: float          # fraction of inflows round-tripping
    window_dressing: bool
    major_counterparties: tuple    # ((name, share-of-NEFT), ...)
    history_months: int = 24
    opening_balance_factor: float = 0.4


FLAT = tuple([1.0] * 12)
# Indian retail/food festive curve: Aug..Nov peak, Apr..Jun lean.
FESTIVE = (0.85, 0.9, 0.95, 0.6, 0.6, 0.65, 0.9, 1.2, 1.5, 2.2, 1.8, 1.1)
MILD_FESTIVE = (0.95, 0.95, 1.0, 0.9, 0.9, 0.9, 1.0, 1.05, 1.1, 1.3, 1.2, 1.05)

PERSONAS: dict[str, Persona] = {p.key: p for p in [
    Persona(
        key="saraswati_kirana",
        business_name="Saraswati Kirana & General Stores", gstin="27AAEPS4821J1Z5",
        pan="AAEPS4821J", sector="Retail Trade", entity_type="proprietorship",
        city="Nashik", state="Maharashtra", incorporation_date="2018-04-12",
        is_ntc=True, is_ntb=True,
        base_monthly_revenue=700_000, annual_growth=0.06, seasonality=MILD_FESTIVE,
        gst_declared_ratio=0.78,  # cash-economy under-declaration, not fraud
        channel_mix={"UPI": 0.55, "NEFT": 0.05, "IMPS": 0.05, "CASH": 0.35},
        margin=0.09, employees=3, employee_trend=0.0, avg_wage=15_000,
        epfo_on_time_rate=0.7, existing_emis=(("ACH D- TVS CREDIT EMI", 22_000),),
        bounce_months_ago=(), gst_delay_base=4, gst_delay_trend=0.05,
        circular_share=0.0, window_dressing=False,
        major_counterparties=(("Sahyadri Distributors", 0.6), ("Nashik Agro Traders", 0.4)),
    ),
    Persona(
        key="rathore_textiles",
        business_name="Rathore Textiles Trading Co.", gstin="24ABFPR7743K1ZC",
        pan="ABFPR7743K", sector="Wholesale Trade", entity_type="partnership",
        city="Surat", state="Gujarat", incorporation_date="2024-11-20",
        is_ntc=True, is_ntb=True,
        base_monthly_revenue=400_000, annual_growth=0.02, seasonality=FLAT,
        gst_declared_ratio=2.9,  # inflated turnover — the fraud persona
        channel_mix={"UPI": 0.1, "NEFT": 0.7, "IMPS": 0.2, "CASH": 0.0},
        margin=0.05, employees=2, employee_trend=0.0, avg_wage=12_000,
        epfo_on_time_rate=0.95,  # fraudsters are often punctual on paper
        existing_emis=(), bounce_months_ago=(), gst_delay_base=1, gst_delay_trend=0.0,
        circular_share=0.38, window_dressing=True,
        major_counterparties=(("Shreenath Fabrics", 0.45), ("Balaji Textile House", 0.35), ("Ambika Yarn Traders", 0.20)),
        history_months=18,
    ),
    Persona(
        key="meher_foods",
        business_name="Meher Foods Private Limited", gstin="27AACCM9034Q1ZP",
        pan="AACCM9034Q", sector="Food Products Manufacturing", entity_type="private_limited",
        city="Pune", state="Maharashtra", incorporation_date="2016-08-03",
        is_ntc=False, is_ntb=True,
        base_monthly_revenue=1_500_000, annual_growth=0.12, seasonality=FESTIVE,
        gst_declared_ratio=0.96,
        channel_mix={"UPI": 0.25, "NEFT": 0.55, "IMPS": 0.1, "CASH": 0.1},
        margin=0.13, employees=18, employee_trend=0.05, avg_wage=18_000,
        epfo_on_time_rate=0.95, existing_emis=(("ACH D- HDFC BANK TERM LOAN", 65_000),),
        bounce_months_ago=(), gst_delay_base=2, gst_delay_trend=0.0,
        circular_share=0.0, window_dressing=False,
        major_counterparties=(("Reliance Retail Ltd", 0.35), ("DMart Avenue Supermarts", 0.3),
                              ("Metro Cash & Carry", 0.2), ("Regional Distributors", 0.15)),
    ),
    Persona(
        key="nexus_digital",
        business_name="Nexus Digital Services LLP", gstin="29AAKFN2210M1Z2",
        pan="AAKFN2210M", sector="IT & Professional Services", entity_type="llp",
        city="Bengaluru", state="Karnataka", incorporation_date="2021-02-15",
        is_ntc=True, is_ntb=True,
        base_monthly_revenue=900_000, annual_growth=0.25, seasonality=FLAT,
        gst_declared_ratio=1.0,
        channel_mix={"UPI": 0.05, "NEFT": 0.9, "IMPS": 0.05, "CASH": 0.0},
        margin=0.2, employees=11, employee_trend=0.15, avg_wage=45_000,
        epfo_on_time_rate=1.0, existing_emis=(), bounce_months_ago=(),
        gst_delay_base=1, gst_delay_trend=0.0,
        circular_share=0.0, window_dressing=False,
        major_counterparties=(("Traya Health Pvt Ltd", 0.38), ("Kite Commerce Inc", 0.27),
                              ("Lumen Retail Tech", 0.2), ("Assorted SME clients", 0.15)),
    ),
    Persona(
        key="balaji_auto",
        business_name="Balaji Auto Components", gstin="33AAGFB6621R1ZK",
        pan="AAGFB6621R", sector="Auto Components Manufacturing", entity_type="partnership",
        city="Chennai", state="Tamil Nadu", incorporation_date="2012-06-30",
        is_ntc=False, is_ntb=False,
        base_monthly_revenue=2_200_000, annual_growth=-0.18, seasonality=FLAT,
        gst_declared_ratio=0.97,
        channel_mix={"UPI": 0.05, "NEFT": 0.8, "IMPS": 0.1, "CASH": 0.05},
        margin=0.16, employees=25, employee_trend=-0.15, avg_wage=22_000,
        epfo_on_time_rate=0.75,
        existing_emis=(("ACH D- IDBI BANK TERM LOAN", 185_000),
                       ("ACH D- BAJAJ FINANCE WCDL", 95_000),
                       ("ACH D- CHOLA MS EQUIP LOAN", 62_000)),
        bounce_months_ago=(2, 3, 5), gst_delay_base=2, gst_delay_trend=0.55,
        circular_share=0.0, window_dressing=False,
        major_counterparties=(("Ashok Leyland Vendor A/c", 0.5), ("TVS Sundaram Fasteners", 0.3),
                              ("Tier-2 OEM suppliers", 0.2)),
    ),
    Persona(
        key="greenleaf_organics",
        business_name="GreenLeaf Organics", gstin="06AAHFG8812C1ZR",
        pan="AAHFG8812C", sector="FMCG / D2C", entity_type="partnership",
        city="Gurugram", state="Haryana", incorporation_date="2025-04-01",
        is_ntc=True, is_ntb=True,
        base_monthly_revenue=300_000, annual_growth=0.45, seasonality=MILD_FESTIVE,
        gst_declared_ratio=0.92,
        channel_mix={"UPI": 0.8, "NEFT": 0.15, "IMPS": 0.05, "CASH": 0.0},
        margin=0.14, employees=6, employee_trend=0.3, avg_wage=20_000,
        epfo_on_time_rate=0.9, existing_emis=(),
        bounce_months_ago=(), gst_delay_base=3, gst_delay_trend=0.0,
        circular_share=0.0, window_dressing=False,
        major_counterparties=(("Amazon Seller Services", 0.5), ("Flipkart Internet", 0.5)),
        history_months=14,
    ),
]}

SECTORS = sorted({p.sector for p in PERSONAS.values()} | {"Logistics", "Healthcare Services", "Construction"})


def procedural_persona(business_name: str, gstin: str, pan: str, sector: str,
                       entity_type: str, city: str, state: str,
                       incorporation_date: str, is_ntc: bool, is_ntb: bool) -> Persona:
    """Deterministic persona for applicants created at runtime, seeded by
    GSTIN — so a brand-new application still flows end-to-end."""
    rng = random.Random(f"procedural:{gstin}")
    return Persona(
        key=f"proc_{gstin}",
        business_name=business_name, gstin=gstin, pan=pan, sector=sector,
        entity_type=entity_type, city=city, state=state,
        incorporation_date=incorporation_date, is_ntc=is_ntc, is_ntb=is_ntb,
        base_monthly_revenue=rng.randrange(300_000, 1_800_000, 50_000),
        annual_growth=rng.uniform(-0.05, 0.3),
        seasonality=MILD_FESTIVE if rng.random() < 0.5 else FLAT,
        gst_declared_ratio=rng.uniform(0.85, 1.05),
        channel_mix={"UPI": 0.4, "NEFT": 0.4, "IMPS": 0.1, "CASH": 0.1},
        margin=rng.uniform(0.08, 0.18),
        employees=rng.randint(3, 20), employee_trend=rng.uniform(0.0, 0.1),
        avg_wage=rng.randrange(14_000, 30_000, 1_000),
        epfo_on_time_rate=rng.uniform(0.7, 1.0),
        existing_emis=(("ACH D- NBFC BUSINESS LOAN", rng.randrange(10_000, 60_000, 5_000)),) if rng.random() < 0.5 else (),
        bounce_months_ago=(), gst_delay_base=rng.uniform(1, 6), gst_delay_trend=rng.uniform(0, 0.1),
        circular_share=0.0, window_dressing=False,
        major_counterparties=(("Primary Buyer A", 0.5), ("Primary Buyer B", 0.3), ("Others", 0.2)),
    )


def resolve_persona(persona_key: str | None, **applicant_fields) -> Persona:
    if persona_key and persona_key in PERSONAS:
        return PERSONAS[persona_key]
    return procedural_persona(**applicant_fields)


# --------------------------------------------------------------------------
# Time helpers
# --------------------------------------------------------------------------

def month_list(months: int, anchor: date | None = None) -> list[tuple[int, int]]:
    """Last `months` calendar months ending the month before the anchor."""
    anchor = anchor or settings.demo_anchor
    y, m = anchor.year, anchor.month
    out = []
    for _ in range(months):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        out.append((y, m))
    return list(reversed(out))


def _month_str(y: int, m: int) -> str:
    return f"{y:04d}-{m:02d}"


def _days_in_month(y: int, m: int) -> int:
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return (nxt - date(y, m, 1)).days


def monthly_revenue(p: Persona, idx: int, y: int, m: int, rng: random.Random) -> float:
    growth = (1 + p.annual_growth) ** (idx / 12)
    return p.base_monthly_revenue * growth * p.seasonality[m - 1] * rng.uniform(0.95, 1.05)


# --------------------------------------------------------------------------
# Bank statement payload (what an AA FIU pull returns)
# --------------------------------------------------------------------------

_UPI_HANDLES = ("okhdfcbank", "oksbi", "paytm", "ybl", "okaxis", "ibl")


def bank_payload(p: Persona) -> dict:
    rng = random.Random(f"{p.key}:bank")
    months = month_list(p.history_months)
    txns: list[dict] = []
    balance = p.base_monthly_revenue * p.opening_balance_factor

    def add(d: date, narration: str, amount: float, direction: str, channel: str, counterparty: str):
        nonlocal balance
        amount = round(max(amount, 1))
        balance = balance + amount if direction == "CR" else balance - amount
        txns.append({
            "date": d.isoformat(), "narration": narration, "amount": int(amount),
            "direction": direction, "channel": channel, "counterparty": counterparty,
            "balance_after": int(round(balance)),
        })

    for idx, (y, m) in enumerate(months):
        dim = _days_in_month(y, m)
        revenue = monthly_revenue(p, idx, y, m, rng)

        # ---- credits: revenue split across channels --------------------
        upi_total = revenue * p.channel_mix.get("UPI", 0)
        n_upi = rng.randint(10, 22)
        for _ in range(n_upi):
            d = date(y, m, rng.randint(1, dim))
            handle = rng.choice(_UPI_HANDLES)
            add(d, f"UPI/CR/{rng.randint(10**11, 10**12 - 1)}/{handle}/collections",
                upi_total / n_upi * rng.uniform(0.5, 1.5), "CR", "UPI", "UPI Collections")

        neft_total = revenue * p.channel_mix.get("NEFT", 0)
        for name, share in p.major_counterparties:
            n_pay = rng.randint(1, 3)
            for _ in range(n_pay):
                d = date(y, m, rng.randint(3, dim))
                add(d, f"NEFT CR-{name.upper()[:24]}-INV SETTLEMENT",
                    neft_total * share / n_pay, "CR", "NEFT", name)

        imps_total = revenue * p.channel_mix.get("IMPS", 0)
        if imps_total > 0:
            for _ in range(rng.randint(1, 4)):
                d = date(y, m, rng.randint(1, dim))
                add(d, f"IMPS-P2A-{rng.randint(10**8, 10**9 - 1)}-retail settlement",
                    imps_total / 3 * rng.uniform(0.6, 1.4), "CR", "IMPS", "Retail Buyers")

        cash_total = revenue * p.channel_mix.get("CASH", 0)
        if cash_total > 0:
            for _ in range(rng.randint(2, 5)):
                d = date(y, m, rng.randint(1, dim))
                add(d, "CASH DEPOSIT - BRANCH", cash_total / 3.5 * rng.uniform(0.7, 1.3), "CR", "CASH", "Cash Deposit")

        # ---- window dressing: round month-end credits (fraud persona) --
        if p.window_dressing:
            wd_total = revenue * 0.45
            for _ in range(rng.randint(2, 3)):
                d = date(y, m, rng.randint(dim - 4, dim))
                amt = round(wd_total / 2 / 50_000) * 50_000 or 50_000
                add(d, f"NEFT CR-{rng.choice([c for c, _ in p.major_counterparties]).upper()}-ADVANCE",
                    amt, "CR", "NEFT", rng.choice([c for c, _ in p.major_counterparties]))

        # ---- circular flows: in on day D, out on D+2..7 -----------------
        if p.circular_share > 0:
            circ_total = revenue * p.circular_share
            for _ in range(rng.randint(2, 4)):
                cp = rng.choice([c for c, _ in p.major_counterparties])
                d_in = date(y, m, rng.randint(1, max(1, dim - 8)))
                amt = circ_total / 3 * rng.uniform(0.8, 1.2)
                add(d_in, f"NEFT CR-{cp.upper()}-TRADE ADVANCE", amt, "CR", "NEFT", cp)
                add(d_in + timedelta(days=rng.randint(2, 7)),
                    f"NEFT DR-{cp.upper()}-SUPPLIER PAYMENT", amt * rng.uniform(0.95, 1.0), "DR", "NEFT", cp)

        # ---- debits ------------------------------------------------------
        salaries = p.employees * ((1 + p.employee_trend) ** (idx / 12)) * p.avg_wage
        add(date(y, m, min(dim, 1 + rng.randint(0, 2))), "SALARY DISBURSEMENT - STAFF", salaries, "DR", "NEFT", "Payroll")
        add(date(y, m, 5), "RENT - PREMISES", p.base_monthly_revenue * 0.03, "DR", "NEFT", "Landlord")
        add(date(y, m, rng.randint(8, 14)), "ELECTRICITY & UTILITIES", p.base_monthly_revenue * 0.012, "DR", "ACH", "Utility Board")
        add(date(y, m, 20), "GST PAYMENT - PMT-06 CHALLAN",
            revenue * p.gst_declared_ratio * 0.055, "DR", "NEFT", "GSTN")

        months_ago = len(months) - idx
        bounce_now = months_ago in p.bounce_months_ago
        for e_i, (narr, emi) in enumerate(p.existing_emis):
            d = date(y, m, 5 + 2 * e_i)
            if bounce_now and e_i == 0:
                add(d, f"{narr} - RETURN INSUFFICIENT FUNDS", 0, "DR", "ACH", "Lender")
                add(d, "ACH RTN CHG + GST", 590, "DR", "CHARGES", "Bank Charges")
                add(d + timedelta(days=rng.randint(3, 6)), f"{narr} - REPRESENTED", emi, "DR", "ACH", "Lender")
            else:
                add(d, narr, emi, "DR", "ACH", "Lender")

        # vendors soak up the rest of the outflow budget
        vendor_budget = revenue * (1 - p.margin) - salaries \
            - p.base_monthly_revenue * 0.042 - revenue * p.gst_declared_ratio * 0.055
        vendor_budget = max(vendor_budget, revenue * 0.1)
        for _ in range(rng.randint(4, 8)):
            d = date(y, m, rng.randint(2, dim))
            add(d, f"NEFT DR-VENDOR {rng.randint(100, 999)}-PURCHASES", vendor_budget / 6 * rng.uniform(0.7, 1.3),
                "DR", "NEFT", f"Vendor {rng.randint(1, 9)}")

        # owner drawings keep balances realistic instead of compounding forever
        if p.margin > 0:
            add(date(y, m, min(dim, 28)), "IMPS DR- PARTNER/PROPRIETOR DRAWINGS",
                revenue * p.margin * 0.3, "DR", "IMPS", "Drawings")

    txns.sort(key=lambda t: t["date"])
    # recompute running balance in strict date order
    balance = p.base_monthly_revenue * p.opening_balance_factor
    for t in txns:
        balance = balance + t["amount"] if t["direction"] == "CR" else balance - t["amount"]
        t["balance_after"] = int(round(balance))

    return {
        "fip": "PARAKH-MOCK-FIP",
        "account": {
            "type": "CURRENT", "masked_number": f"XXXXXXXX{random.Random(p.key).randint(1000, 9999)}",
            "ifsc": "IBKL0000001", "holder": p.business_name,
        },
        "period": {"from": f"{months[0][0]:04d}-{months[0][1]:02d}-01",
                   "to": _month_str(*months[-1])},
        "transactions": txns,
    }


# --------------------------------------------------------------------------
# GST payload (what a GSP returns-fetch returns)
# --------------------------------------------------------------------------

def gst_payload(p: Persona) -> dict:
    rng = random.Random(f"{p.key}:gst")
    rev_rng = random.Random(f"{p.key}:bank")  # same stream → same revenue path
    months = month_list(p.history_months)
    returns = []
    for idx, (y, m) in enumerate(months):
        actual = monthly_revenue(p, idx, y, m, rev_rng)
        # consume the same number of draws bank generation would... not needed:
        # monthly_revenue uses one uniform draw per call; alignment is
        # approximate by design — declared vs banked always differ a little.
        declared = actual * p.gst_declared_ratio * rng.uniform(0.97, 1.03)
        due_y, due_m = (y, m + 1) if m < 12 else (y + 1, 1)
        due = date(due_y, due_m, 20)
        delay = max(0, rng.gauss(p.gst_delay_base + p.gst_delay_trend * idx, 2.5))
        returns.append({
            "period": _month_str(y, m),
            "form": "GSTR-3B",
            "turnover_declared": int(declared),
            "tax_paid": int(declared * 0.055),
            "due_date": due.isoformat(),
            "filing_date": (due + timedelta(days=round(delay))).isoformat(),
            "delay_days": round(delay),
            "status": "FILED",
        })
    return {
        "gstin": p.gstin, "legal_name": p.business_name,
        "registration_date": p.incorporation_date if p.key != "rathore_textiles" else "2024-11-20",
        "state": p.state, "returns": returns,
    }


# --------------------------------------------------------------------------
# EPFO payload
# --------------------------------------------------------------------------

def epfo_payload(p: Persona) -> dict:
    rng = random.Random(f"{p.key}:epfo")
    months = month_list(p.history_months)
    rows = []
    for idx, (y, m) in enumerate(months):
        emp = max(1, round(p.employees * (1 + p.employee_trend) ** (idx / 12)))
        wages = emp * p.avg_wage * rng.uniform(0.97, 1.03)
        rows.append({
            "month": _month_str(y, m),
            "employees": emp,
            "wages_total": int(wages),
            "contribution": int(wages * 0.24),
            "paid_on_time": rng.random() < p.epfo_on_time_rate,
        })
    return {"establishment_name": p.business_name, "uan_count": p.employees, "months": rows}
