"""Shared feature extraction: raw source payloads → aligned monthly series.

Every engine consumes this one structure, so a number shown anywhere in the
product traces back to the same computation.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from statistics import mean, pstdev


@dataclass
class MonthRow:
    month: str
    inflow: float = 0.0
    outflow: float = 0.0
    avg_balance: float = 0.0
    emi: float = 0.0
    bounces: int = 0
    gst_turnover: float | None = None
    gst_delay: float | None = None
    employees: int | None = None
    epfo_on_time: bool | None = None

    @property
    def net(self) -> float:
        return self.inflow - self.outflow


@dataclass
class Features:
    rows: list[MonthRow] = field(default_factory=list)
    counterparty_credits: dict = field(default_factory=dict)
    counterparty_debits: dict = field(default_factory=dict)
    circular_amount: float = 0.0
    round_eom_credit: float = 0.0
    total_credit: float = 0.0
    seasonal_index: dict = field(default_factory=dict)  # month number -> factor

    # -- convenience -------------------------------------------------------
    @property
    def months(self) -> list[str]:
        return [r.month for r in self.rows]

    def series(self, attr: str) -> list[float]:
        return [getattr(r, attr) or 0 for r in self.rows]

    @property
    def bank_annual_inflow(self) -> float:
        rows = self.rows[-12:]
        scale = 12 / len(rows) if rows else 0
        return sum(r.inflow for r in rows) * scale

    @property
    def inflow_haircut(self) -> float:
        """Fraction of credits discounted as circular / window-dressed."""
        if self.total_credit <= 0:
            return 0.0
        return min(0.9, (self.circular_amount + self.round_eom_credit) / self.total_credit)

    @property
    def verified_annual_inflow(self) -> float:
        return self.bank_annual_inflow * (1 - self.inflow_haircut)

    @property
    def gst_annual_declared(self) -> float:
        rows = [r for r in self.rows[-12:] if r.gst_turnover is not None]
        if not rows:
            return 0.0
        return sum(r.gst_turnover for r in rows) * 12 / len(rows)

    @property
    def avg_monthly_emi(self) -> float:
        rows = self.rows[-12:]
        return mean([r.emi for r in rows]) if rows else 0.0

    def deseasonalized(self, values: list[float]) -> list[float]:
        out = []
        for r, v in zip(self.rows, values):
            m = int(r.month.split("-")[1])
            out.append(v / self.seasonal_index.get(m, 1.0))
        return out


def _month_of(iso_date: str) -> str:
    return iso_date[:7]


def build_features(bank: dict | None, gst: dict | None, epfo: dict | None) -> Features:
    f = Features()
    by_month: dict[str, MonthRow] = {}

    def row(month: str) -> MonthRow:
        if month not in by_month:
            by_month[month] = MonthRow(month=month)
        return by_month[month]

    # ---- bank ------------------------------------------------------------
    balances: dict[str, list[float]] = defaultdict(list)
    if bank:
        for t in bank.get("transactions", []):
            m = _month_of(t["date"])
            r = row(m)
            amount, cp = t["amount"], t["counterparty"]
            if t["direction"] == "CR":
                r.inflow += amount
                f.total_credit += amount
                f.counterparty_credits[cp] = f.counterparty_credits.get(cp, 0) + amount
                day = int(t["date"][8:10])
                if day >= 25 and amount >= 50_000 and amount % 50_000 == 0:
                    f.round_eom_credit += amount
            else:
                r.outflow += amount
                f.counterparty_debits[cp] = f.counterparty_debits.get(cp, 0) + amount
                narr = t["narration"].upper()
                if "ACH D-" in narr and "RETURN INSUFFICIENT" not in narr:
                    r.emi += amount
                if "RETURN INSUFFICIENT" in narr:
                    r.bounces += 1
            balances[m].append(t["balance_after"])

        for m, vals in balances.items():
            row(m).avg_balance = mean(vals)

        # circularity: value flowing out to the same counterparties it came from
        for cp, cr in f.counterparty_credits.items():
            dr = f.counterparty_debits.get(cp, 0)
            if cp not in ("Payroll", "Landlord", "Utility Board", "GSTN", "Lender",
                          "Bank Charges", "Drawings") and not cp.startswith("Vendor"):
                f.circular_amount += min(cr, dr)

    # ---- gst ---------------------------------------------------------------
    if gst:
        for ret in gst.get("returns", []):
            r = row(ret["period"])
            r.gst_turnover = (r.gst_turnover or 0) + ret["turnover_declared"]
            r.gst_delay = ret["delay_days"]

    # ---- epfo --------------------------------------------------------------
    if epfo:
        for month_row in epfo.get("months", []):
            r = row(month_row["month"])
            r.employees = month_row["employees"]
            r.epfo_on_time = month_row["paid_on_time"]

    f.rows = [by_month[m] for m in sorted(by_month)]

    # seasonal index from inflows (needs > a year of history)
    if len(f.rows) >= 13:
        overall = mean([r.inflow for r in f.rows]) or 1.0
        groups: dict[int, list[float]] = defaultdict(list)
        for r in f.rows:
            groups[int(r.month.split("-")[1])].append(r.inflow)
        f.seasonal_index = {m: max(0.2, mean(v) / overall) for m, v in groups.items()}
    else:
        f.seasonal_index = {m: 1.0 for m in range(1, 13)}

    return f


# --- small math helpers shared by engines ----------------------------------

def linear_fit(values: list[float]) -> tuple[float, float, float, float]:
    """OLS fit y = a + b*t. Returns (a, b, r2, residual_std)."""
    n = len(values)
    if n < 2:
        return (values[0] if values else 0.0, 0.0, 0.0, 0.0)
    xs = list(range(n))
    mx, my = mean(xs), mean(values)
    sxx = sum((x - mx) ** 2 for x in xs) or 1.0
    b = sum((x - mx) * (y - my) for x, y in zip(xs, values)) / sxx
    a = my - b * mx
    resid = [y - (a + b * x) for x, y in zip(xs, values)]
    ss_res = sum(r * r for r in resid)
    ss_tot = sum((y - my) ** 2 for y in values) or 1.0
    r2 = max(0.0, 1 - ss_res / ss_tot)
    return a, b, r2, (pstdev(resid) if n > 2 else abs(resid[0]))


def piecewise(value: float, points: list[tuple[float, float]]) -> float:
    """Map value → score via linear interpolation over (value, score) points
    sorted by value. Clamps outside the range."""
    pts = sorted(points)
    if value <= pts[0][0]:
        return pts[0][1]
    if value >= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= value <= x1:
            if x1 == x0:
                return y1
            return y0 + (y1 - y0) * (value - x0) / (x1 - x0)
    return pts[-1][1]


def cv(values: list[float]) -> float:
    m = mean(values) if values else 0.0
    if m == 0:
        return 5.0
    return abs(pstdev(values) / m)
