"""Server integration checks: accounts, privacy, concurrent writes and persistence."""

import copy
from http.cookiejar import CookieJar
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import AppServer, today


class Client:
    def __init__(self, url):
        self.url = url
        self.csrf = ""
        self.jar = CookieJar()
        self.http = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar)
        )

    def request(self, path, method="GET", body=None, headers=None):
        hdr = {"Origin": self.url}
        if self.csrf:
            hdr["X-CSRF-Token"] = self.csrf
        hdr.update(headers or {})
        payload = None
        if body is not None:
            if isinstance(body, bytes):
                payload = body
            else:
                payload = json.dumps(body).encode()
                hdr.setdefault("Content-Type", "application/json")
        req = urllib.request.Request(
            self.url + path, data=payload, headers=hdr, method=method
        )
        try:
            with self.http.open(req, timeout=15) as response:
                raw = response.read()
                return (
                    response.status,
                    (
                        json.loads(raw)
                        if response.headers.get_content_type() == "application/json"
                        else raw
                    ),
                    response.headers,
                )
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read()), error.headers

    def status(self):
        _, value, _ = self.request("/api/auth/status")
        self.csrf = value.get("csrf", "")
        return value


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = json.loads(
            subprocess.check_output(
                [
                    "node",
                    "--input-type=module",
                    "-e",
                    "import {seedData} from './data.js';process.stdout.write(JSON.stringify(seedData()))",
                ],
                cwd=Path(__file__).resolve().parents[1],
            )
        )

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="stc-test-")
        self.server = AppServer(("127.0.0.1", 0), self.temp.name)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = "http://127.0.0.1:" + str(self.server.server_port)
        self.coach = Client(self.url)
        status, _, _ = self.coach.request(
            "/api/auth/setup",
            "POST",
            {
                "name": "Test Coach",
                "email": "coach@example.com",
                "password": "Test coach password 123",
                "workspace": copy.deepcopy(self.seed),
            },
        )
        self.assertEqual(status, 201)
        self.coach.status()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def member(self, cid="c0"):
        status, invite, _ = self.coach.request(
            "/api/invitations", "POST", {"client": cid}
        )
        self.assertEqual(status, 201)
        member = Client(self.url)
        status, _, _ = member.request(
            "/api/auth/accept",
            "POST",
            {"token": invite["token"], "password": "Test member password 123"},
        )
        self.assertEqual(status, 201)
        member.status()
        return member, invite

    def test_account_setup_login_and_logout(self):
        anon = Client(self.url)
        self.assertEqual(anon.request("/api/workspace")[0], 401)
        self.assertEqual(
            anon.request(
                "/api/auth/login",
                "POST",
                {"email": "coach@example.com", "password": "wrong"},
            )[0],
            401,
        )
        status, _, headers = anon.request(
            "/api/auth/login",
            "POST",
            {"email": "coach@example.com", "password": "Test coach password 123"},
        )
        self.assertEqual(status, 200)
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", headers["Set-Cookie"])
        self.assertTrue(anon.status()["authenticated"])
        self.assertEqual(anon.request("/api/auth/logout", "POST")[0], 200)
        self.assertFalse(anon.status()["authenticated"])
        self.assertEqual(
            anon.request(
                "/api/auth/setup",
                "POST",
                {
                    "name": "Other",
                    "email": "other@example.com",
                    "password": "Other test password 123",
                    "workspace": self.seed,
                },
            )[0],
            409,
        )

    def test_member_cannot_read_or_edit_other_clients(self):
        member, _ = self.member()
        status, result, _ = member.request("/api/workspace")
        self.assertEqual(status, 200)
        w = result["workspace"]
        self.assertEqual([c["id"] for c in w["clients"]], ["c0"])
        self.assertEqual(w["clients"][0]["notes"], [])
        self.assertTrue(
            all(
                m["client"] == "c0" for k in ["measures", "meals", "logs"] for m in w[k]
            )
        )
        self.assertEqual(
            member.request(
                "/api/workspace",
                "PUT",
                {"workspace": self.seed, "revision": result["revision"]},
            )[0],
            403,
        )
        self.assertEqual(
            member.request("/api/invitations", "POST", {"client": "c1"})[0], 403
        )
        self.assertEqual(
            member.request(
                "/api/videos/e0",
                "POST",
                b"\x1aE\xdf\xa3test",
                {"Content-Type": "video/webm"},
            )[0],
            403,
        )
        status, board, _ = member.request("/api/leaderboard")
        self.assertEqual(status, 200)
        self.assertEqual([r["id"] for r in board["rows"]], ["c0"])
        self.assertNotIn("Body weight", json.dumps(board))

    def test_invitations_single_use_expiry_and_password_reset(self):
        member, invite = self.member()
        other = Client(self.url)
        self.assertEqual(
            other.request(
                "/api/auth/accept",
                "POST",
                {"token": invite["token"], "password": "Another password 123"},
            )[0],
            410,
        )
        _, new, _ = self.coach.request("/api/invitations", "POST", {"client": "c0"})
        self.assertEqual(
            other.request(
                "/api/auth/accept",
                "POST",
                {"token": new["token"], "password": "Replacement password 123"},
            )[0],
            201,
        )
        self.assertEqual(member.request("/api/workspace")[0], 401)
        with self.server.db() as db:
            db.execute("UPDATE invitations SET expires=0")
            db.commit()
        self.assertEqual(other.request("/api/invitations/" + invite["token"])[0], 410)

    def test_csrf_cross_origin_and_private_files(self):
        self.assertEqual(
            self.coach.request(
                "/api/auth/logout", "POST", headers={"X-CSRF-Token": "wrong"}
            )[0],
            403,
        )
        self.assertEqual(
            self.coach.request(
                "/api/invitations",
                "POST",
                {"client": "c0"},
                {"Origin": "https://other.invalid"},
            )[0],
            403,
        )
        anon = Client(self.url)
        for path in [
            "/server.py",
            "/.git/config",
            "/.data/club.sqlite3",
            "/assets/../server.py",
        ]:
            self.assertEqual(anon.request(path)[0], 404, path)
        self.assertEqual(anon.request("/api/videos/e0")[0], 401)
        self.assertEqual(
            anon.request(
                "/api/auth/login",
                "POST",
                {"email": "coach@example.com", "password": "Test coach password 123"},
                {"Origin": "https://other.invalid"},
            )[0],
            403,
        )

    def test_conflicts_prevent_lost_member_updates(self):
        member, _ = self.member()
        _, initial, _ = self.coach.request("/api/workspace")
        status, _, _ = member.request(
            "/api/member/actions",
            "POST",
            {"action": "checkin", "key": "checkin-1", "text": "Feeling stronger."},
        )
        self.assertEqual(status, 200)
        self.assertEqual(self.coach.request("/api/workspace", "PUT", initial)[0], 409)
        _, updated, _ = self.coach.request("/api/workspace")
        self.assertEqual(
            updated["workspace"]["clients"][0]["checkin"], "Feeling stronger."
        )
        updated["workspace"]["settings"]["club"] = "A stronger club"
        self.assertEqual(self.coach.request("/api/workspace", "PUT", updated)[0], 200)

    def test_member_logs_are_scoped_and_idempotent(self):
        member, _ = self.member()
        _, before, _ = member.request("/api/workspace")
        completed = [e["id"] for e in before["workspace"]["programmes"][0]["exercises"]]
        payload = {
            "action": "workout",
            "key": "workout-unique",
            "completed": completed,
            "client": "c1",
            "entries": [{"exercise": completed[0], "weight": 40, "reps": 10}],
        }
        status, after, _ = member.request("/api/member/actions", "POST", payload)
        self.assertEqual(status, 200)
        self.assertEqual(
            len(after["workspace"]["logs"]), len(before["workspace"]["logs"]) + 1
        )
        self.assertEqual(after["workspace"]["logs"][-1]["client"], "c0")
        self.assertEqual(after["workspace"]["logs"][-1]["entries"][0]["weight"], 40)
        status, repeat, _ = member.request("/api/member/actions", "POST", payload)
        self.assertEqual(status, 200)
        self.assertEqual(
            len(repeat["workspace"]["logs"]), len(after["workspace"]["logs"])
        )
        self.assertEqual(
            member.request(
                "/api/member/actions",
                "POST",
                {"action": "workout", "key": "bad", "completed": ["e0"]},
            )[0],
            400,
        )
        self.assertEqual(
            member.request(
                "/api/member/actions",
                "POST",
                {
                    "action": "result",
                    "key": "bad-number",
                    "kind": "Body weight",
                    "value": -10,
                    "date": today(),
                },
            )[0],
            400,
        )

    def test_video_storage_range_and_validation(self):
        raw = b"\x1aE\xdf\xa3" + bytes(range(100))
        self.assertEqual(
            self.coach.request(
                "/api/videos/e0", "POST", raw, {"Content-Type": "video/webm"}
            )[0],
            200,
        )
        self.assertEqual(
            self.coach.request(
                "/api/videos/e0", "POST", b"fake file", {"Content-Type": "video/webm"}
            )[0],
            415,
        )
        member, _ = self.member()
        status, body, headers = member.request(
            "/api/videos/e0", headers={"Range": "bytes=0-9"}
        )
        self.assertEqual(status, 206)
        self.assertEqual(body, raw[:10])
        self.assertEqual(headers["Content-Range"], f"bytes 0-9/{len(raw)}")
        self.assertEqual(
            member.request("/api/videos/e0", headers={"Range": "bytes=1000-"})[0], 416
        )

    def test_password_change_and_rate_limits(self):
        self.assertEqual(
            self.coach.request(
                "/api/password",
                "POST",
                {"current": "wrong", "password": "Replacement password 123"},
            )[0],
            403,
        )
        self.assertEqual(
            self.coach.request(
                "/api/password",
                "POST",
                {"current": "Test coach password 123", "password": "short"},
            )[0],
            400,
        )
        self.assertEqual(
            self.coach.request(
                "/api/password",
                "POST",
                {
                    "current": "Test coach password 123",
                    "password": "Replacement password 123",
                },
            )[0],
            200,
        )
        anon = Client(self.url)
        for _ in range(10):
            self.assertEqual(
                anon.request(
                    "/api/auth/login",
                    "POST",
                    {"email": "coach@example.com", "password": "wrong"},
                )[0],
                401,
            )
        self.assertEqual(
            anon.request(
                "/api/auth/login",
                "POST",
                {"email": "coach@example.com", "password": "wrong"},
            )[0],
            429,
        )

    def test_database_survives_restart(self):
        _, w, _ = self.coach.request("/api/workspace")
        w["workspace"]["settings"]["club"] = "Persistent club"
        self.assertEqual(self.coach.request("/api/workspace", "PUT", w)[0], 200)
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.server = AppServer(("127.0.0.1", 0), self.temp.name)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        fresh = Client("http://127.0.0.1:" + str(self.server.server_port))
        self.assertEqual(
            fresh.request(
                "/api/auth/login",
                "POST",
                {"email": "coach@example.com", "password": "Test coach password 123"},
            )[0],
            200,
        )
        fresh.status()
        _, state, _ = fresh.request("/api/workspace")
        self.assertEqual(state["workspace"]["settings"]["club"], "Persistent club")

    def test_hosted_setup_requires_code_and_secure_cookie(self):
        self.server.local_setup = False
        self.server.public_origin = "https://club.example"
        self.server.setup_token = "test-bootstrap-code"
        anon = Client(self.url)
        self.assertEqual(
            anon.request(
                "/api/auth/login",
                "POST",
                {"email": "coach@example.com", "password": "Test coach password 123"},
                {"Origin": "https://club.example"},
            )[0],
            200,
        )
        with self.server.db() as db:
            db.execute("DELETE FROM users")
            db.execute("DELETE FROM workspace")
            db.commit()
        payload = {
            "name": "Hosted Coach",
            "email": "hosted@example.com",
            "password": "Hosted test password 123",
            "workspace": self.seed,
        }
        self.assertEqual(
            anon.request(
                "/api/auth/setup", "POST", payload, {"Origin": "https://club.example"}
            )[0],
            403,
        )
        payload["setupToken"] = "test-bootstrap-code"
        status, _, headers = anon.request(
            "/api/auth/setup", "POST", payload, {"Origin": "https://club.example"}
        )
        self.assertEqual(status, 201)
        self.assertIn("Secure", headers["Set-Cookie"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
