"""Check a fresh club's setup, empty states and first client workflow."""

import os
from pathlib import Path
import sys
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import AppServer

ARTIFACTS = Path(
    os.environ.get(
        "STC_TEST_ARTIFACTS", str(Path(tempfile.gettempdir()) / "stc-test-artifacts")
    )
)
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def run(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("STC_CHROMIUM", "/usr/bin/chromium"),
            args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(url)
        expect(page.locator("#auth-form")).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / "stc-sign-in.png"), full_page=True)
        page.locator("[name=name]").fill("Club Coach")
        page.locator("[name=email]").fill("first-coach@test.example")
        page.locator("[name=password]").fill("Fresh club password 123")
        page.locator("#auth-form button[type=submit]").click()
        expect(page.locator("main")).to_contain_text("Your club starts here")
        for route in [
            "clients",
            "programmes",
            "nutrition",
            "library",
            "progress",
            "schedule",
            "leaderboard",
            "settings",
        ]:
            page.locator(".nav-link[data-nav=" + route + "]").click()
            expect(page.locator("h1")).to_be_visible()
            assert not page.evaluate(
                "document.documentElement.scrollWidth > innerWidth"
            ), route
        page.locator(".nav-link[data-nav=clients]").click()
        page.locator("[data-action=add-client]").click()
        form = page.locator("#client-form")
        form.locator("[name=name]").fill("First Client")
        form.locator("[name=email]").fill("first-client@test.example")
        form.locator("[name=programme]").select_option(index=1)
        form.locator("button[type=submit]").click()
        expect(page.locator("#clients-table")).to_contain_text("First Client")
        page.locator(".client-name").click()
        page.locator("[data-action=invite-client]").click()
        expect(page.locator("#invite-link")).to_be_visible()
        invite = page.locator("#invite-link").input_value()
        page.keyboard.press("Escape")
        page.locator(".nav-link[data-nav=overview]").click()
        page.screenshot(path=str(ARTIFACTS / "stc-coach-fresh.png"), full_page=True)
        ctx = browser.new_context(viewport={"width": 390, "height": 844})
        member = ctx.new_page()
        member.on("pageerror", lambda error: errors.append(str(error)))
        member.goto(invite)
        member.locator("#auth-form [name=password]").fill("First client password 123")
        member.locator("#auth-form button[type=submit]").click()
        expect(member.locator("main")).to_contain_text("First")
        expect(member.locator("[data-member-action=start-workout]")).to_be_visible()
        assert not member.evaluate("document.documentElement.scrollWidth > innerWidth")
        assert not errors, errors
        browser.close()
        print(
            "PASS: fresh coach setup, all empty routes, first client assignment and invitation, mobile client onboarding"
        )


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="stc-onboarding-") as folder:
        server = AppServer(("127.0.0.1", 0), folder)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run("http://127.0.0.1:" + str(server.server_port))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
