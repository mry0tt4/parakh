"""Capture product screenshots for the submission deck."""
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = Path(__file__).resolve().parent.parent / "pitch" / "shots"
OUT.mkdir(parents=True, exist_ok=True)


def shot(page, name):
    page.wait_for_timeout(900)
    page.screenshot(path=str(OUT / f"{name}.png"))
    print("captured", name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)

    page.goto(BASE + "/login")
    page.wait_for_load_state("networkidle")
    shot(page, "login")

    page.get_by_label(re.compile("email", re.I)).fill("officer@parakh.demo")
    page.get_by_label(re.compile("password", re.I)).fill("Officer@2026")
    page.get_by_role("button", name=re.compile("sign in", re.I)).click()
    page.wait_for_url(re.compile(r"/$"), timeout=10000)
    page.wait_for_load_state("networkidle")
    shot(page, "dashboard")

    def open_app(name):
        page.goto(BASE + "/applications")
        page.wait_for_load_state("networkidle")
        page.get_by_text(name, exact=False).first.click()
        page.wait_for_load_state("networkidle")

    open_app("Saraswati")
    # clip just above the "Score pillars" card so the bottom edge lands on clean whitespace
    page.wait_for_timeout(900)
    pillars = page.get_by_text(re.compile("score pillars", re.I)).first.bounding_box()
    page.screenshot(path=str(OUT / "assessment.png"),
                    clip={"x": 0, "y": 0, "width": 1440, "height": pillars["y"] - 14})
    print("captured assessment")
    page.get_by_role("button", name=re.compile("^credit memo$", re.I)).first.click()
    # end the crop cleanly above the "3. Data sources & consent" section
    page.wait_for_timeout(900)
    sec3 = page.get_by_text(re.compile(r"3\. Data sources", re.I)).first.bounding_box()
    page.screenshot(path=str(OUT / "memo.png"),
                    clip={"x": 0, "y": 0, "width": 1440, "height": min(886, sec3["y"] - 14)})
    print("captured memo")
    page.get_by_role("link", name=re.compile("health card", re.I)).first.click()
    page.wait_for_load_state("networkidle")
    # crop the card's top (masthead + seal + score) ending cleanly above "Five pillars"
    page.wait_for_timeout(900)
    box = page.locator("article.print-card").bounding_box()
    five = page.get_by_text(re.compile("five pillars", re.I)).first.bounding_box()
    page.screenshot(path=str(OUT / "healthcard.png"),
                    clip={"x": box["x"], "y": box["y"], "width": box["width"],
                          "height": five["y"] - box["y"] - 14})
    print("captured healthcard")

    open_app("Rathore")
    page.get_by_role("button", name=re.compile("^verification$", re.I)).first.click()
    shot(page, "verification")

    open_app("Balaji")
    page.get_by_role("button", name=re.compile("stress", re.I)).first.click()
    shot(page, "stress")

    browser.close()
    print("done ->", OUT)
    sys.exit(0)
