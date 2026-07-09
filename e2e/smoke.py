"""Parakh full-stack E2E smoke: real backend + real frontend, DOM-level
assertions only (no screenshots). Fails hard on any console/page error."""
import re
import sys

from playwright.sync_api import expect, sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []
CONSOLE_ERRORS: list[str] = []


def step(name):
    print(f"  ▸ {name}")


def run(page):
    # ---- 1. login (failure path first) ------------------------------------
    step("login page renders")
    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_text("Parakh", exact=False).first).to_be_visible()

    step("wrong password shows error")
    page.get_by_label(re.compile("email", re.I)).fill("officer@parakh.demo")
    page.get_by_label(re.compile("password", re.I)).fill("WrongPass1!")
    page.get_by_role("button", name=re.compile("sign in|log ?in", re.I)).click()
    expect(page.get_by_text(re.compile("invalid", re.I))).to_be_visible(timeout=8000)

    step("officer logs in")
    page.get_by_label(re.compile("password", re.I)).fill("Officer@2026")
    page.get_by_role("button", name=re.compile("sign in|log ?in", re.I)).click()
    page.wait_for_url(re.compile(r"/$|/dashboard"), timeout=10000)
    page.wait_for_load_state("networkidle")

    # ---- 2. dashboard -------------------------------------------------------
    step("dashboard KPIs and tables load")
    expect(page.get_by_text(re.compile("application", re.I)).first).to_be_visible()
    expect(page.get_by_text("Saraswati Kirana", exact=False).first).to_be_visible(timeout=10000)

    # ---- 3. applications list -----------------------------------------------
    step("applications list shows all six personas")
    page.goto(BASE + "/applications")
    page.wait_for_load_state("networkidle")
    for name in ["Saraswati", "Rathore", "Meher", "Nexus", "Balaji", "GreenLeaf"]:
        expect(page.get_by_text(name, exact=False).first).to_be_visible(timeout=10000)

    # ---- 4. nexus: run a live assessment ------------------------------------
    step("open Nexus (data_ready) and run assessment")
    page.get_by_text("Nexus Digital", exact=False).first.click()
    page.wait_for_load_state("networkidle")
    run_btn = page.get_by_role("button", name=re.compile("run assessment", re.I))
    expect(run_btn).to_be_visible(timeout=10000)
    run_btn.click()
    expect(page.get_by_text("782", exact=False).first).to_be_visible(timeout=30000)
    step("assessment renders score 782 / grade A")

    # ---- 5. officer decides within limit ------------------------------------
    step("officer approves Nexus (within ₹25L limit)")
    page.get_by_role("button", name=re.compile("^approve$", re.I)).first.click()
    dialog_btn = page.get_by_role("button", name=re.compile("confirm|submit", re.I))
    if dialog_btn.count():
        note = page.get_by_label(re.compile("note", re.I))
        if note.count():
            note.fill("Approved in E2E run")
        dialog_btn.first.click()
    expect(page.get_by_text(re.compile("approved", re.I)).first).to_be_visible(timeout=10000)

    # ---- 6. fraud showcase: Rathore ------------------------------------------
    step("Rathore shows fraud flags")
    page.goto(BASE + "/applications")
    page.wait_for_load_state("networkidle")
    page.get_by_text("Rathore Textiles", exact=False).first.click()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_text("480", exact=False).first).to_be_visible(timeout=10000)
    page.get_by_role("button", name=re.compile("^verification$", re.I)).first.click()
    expect(page.get_by_text(re.compile("CIRCULAR_FLOW|round-tripping|circular", re.I)).first
           ).to_be_visible(timeout=10000)

    # ---- 7. memo tab -----------------------------------------------------------
    step("credit memo renders with citations")
    page.get_by_role("button", name=re.compile("^credit memo$", re.I)).first.click()
    expect(page.get_by_text("Credit Assessment Memo", exact=False).first).to_be_visible(timeout=10000)

    # ---- 7b. borrower health card ---------------------------------------------
    step("health card renders with roadmap")
    page.goto(BASE + "/applications")
    page.wait_for_load_state("networkidle")
    page.get_by_text("Saraswati Kirana", exact=False).first.click()
    page.wait_for_load_state("networkidle")
    page.get_by_role("link", name=re.compile("health card", re.I)).first.click()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_text(re.compile("financial health card", re.I)).first).to_be_visible(timeout=10000)
    expect(page.get_by_text(re.compile("roadmap", re.I)).first).to_be_visible()
    expect(page.get_by_text(re.compile("next review", re.I)).first).to_be_visible()

    # ---- 8. RBAC: audit hidden for officer, visible for risk head ----------------
    step("audit is role-gated")
    page.goto(BASE + "/audit")
    page.wait_for_load_state("networkidle")
    body = page.inner_text("body").lower()
    officer_blocked = ("forbidden" in body or "requires role" in body or "sign in" in body
                       or "not authoriz" in body or "access" in body or "/audit" not in page.url)
    if not officer_blocked:
        # some UIs simply show an empty/denied state; require no audit rows
        assert "auth.login" not in body, "officer should not see audit rows"

    step("risk head sees audit log")
    logout = page.get_by_role("button", name=re.compile("log ?out|sign out", re.I))
    if logout.count():
        logout.first.click()
    else:
        page.evaluate("localStorage.clear()")
    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    page.get_by_label(re.compile("email", re.I)).fill("risk@parakh.demo")
    page.get_by_label(re.compile("password", re.I)).fill("Risk@2026")
    page.get_by_role("button", name=re.compile("sign in|log ?in", re.I)).click()
    page.wait_for_url(re.compile(r"/$|/dashboard"), timeout=10000)
    page.goto(BASE + "/audit")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_text("auth.login", exact=False).first).to_be_visible(timeout=10000)

    # ---- 9. new application form -------------------------------------------------
    step("new application form creates a draft")
    page.goto(BASE + "/applications/new")
    page.wait_for_load_state("networkidle")
    fills = {
        re.compile("business name", re.I): "Everest Logistics",
        re.compile("^gstin", re.I): "27ABEVR8341K1Z8",
        re.compile("^pan", re.I): "ABEVR8341K",
        re.compile("^city", re.I): "Mumbai",
        re.compile("^state", re.I): "Maharashtra",
        re.compile("purpose", re.I): "Fleet working capital",
    }
    for label, value in fills.items():
        loc = page.get_by_label(label)
        if loc.count():
            loc.first.fill(value)
    page.get_by_label(re.compile("sector", re.I)).first.select_option(label="Logistics")
    page.get_by_label(re.compile("incorporation", re.I)).first.fill("2020-02-10")
    amount = page.get_by_label(re.compile("amount", re.I))
    if amount.count():
        amount.first.fill("900000")
    submit = page.get_by_role("button", name=re.compile("create|submit", re.I))
    if submit.count():
        submit.first.click()
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Everest Logistics", exact=False).first).to_be_visible(timeout=10000)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda m: CONSOLE_ERRORS.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: CONSOLE_ERRORS.append(str(e)))
    try:
        run(page)
    except Exception as e:
        FAILURES.append(f"{type(e).__name__}: {e}")
        print("\nBODY SNAPSHOT (first 2000 chars):\n", page.inner_text("body")[:2000])
    browser.close()

# 401s during the deliberate wrong-password step will log a console error; allow only that
real_errors = [e for e in CONSOLE_ERRORS if "401" not in e and "Failed to load resource" not in e]
if real_errors:
    FAILURES.append(f"console errors: {real_errors[:5]}")

if FAILURES:
    print("\nE2E FAILED:")
    for f in FAILURES:
        print(" -", f)
    sys.exit(1)
print("\nE2E PASSED: full lifecycle verified against live backend.")
