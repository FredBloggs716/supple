"""Social Training Club: accounts, a shared SQLite workspace and private videos.
No third-party runtime dependencies. Serve behind HTTPS for remote access.
"""

import copy
import datetime as dt
import hashlib
import hmac
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlsplit, unquote
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parent
MAX_JSON = 3 * 1024 * 1024
MAX_VIDEO = 50 * 1024 * 1024
PASSWORD_ROUNDS = 600_000
COOKIE = "stc_session"
STATIC = {
    "index.html",
    "app.js",
    "auth.js",
    "member.js",
    "data.js",
    "icons.js",
    "styles.css",
}
COLLECTIONS = (
    "clients",
    "programmes",
    "exercises",
    "logs",
    "measures",
    "sessions",
    "meals",
    "activity",
)


class APIError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


def text(value, label, limit=200, optional=False):
    if (
        not isinstance(value, str)
        or (not optional and not value.strip())
        or len(value) > limit
    ):
        raise APIError(f"Please enter a valid {label}.")
    return value.strip()


def number(value, label, low=0, high=10000):
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or not low <= value <= high
    ):
        raise APIError(f"Please enter a valid {label}.")
    return value


def date(value, future=True):
    try:
        if (
            not isinstance(value, str)
            or dt.date.fromisoformat(value).isoformat() != value
        ):
            raise ValueError()
    except ValueError:
        raise APIError("Please enter a valid date.")
    if not future and value > today():
        raise APIError("Choose today or an earlier date.")
    return value


def today():
    try:
        return dt.datetime.now(ZoneInfo("Europe/London")).date().isoformat()
    except ZoneInfoNotFoundError:
        # Windows has no system IANA database. Current UK DST runs between
        # 01:00 UTC on the last Sundays in March and October.
        now = dt.datetime.now(dt.timezone.utc)

        def boundary(month):
            last = dt.datetime(now.year, month, 31, 1, tzinfo=dt.timezone.utc)
            return last - dt.timedelta(days=(last.weekday() + 1) % 7)

        return (
            (now + dt.timedelta(hours=int(boundary(3) <= now < boundary(10))))
            .date()
            .isoformat()
        )


def email(value):
    value = text(value, "email address", 254).lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise APIError("Please enter a valid email address.")
    return value


def password_hash(password):
    text(password, "password", 512)
    if len(password) < 12:
        raise APIError("Use a password with at least 12 characters.")
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PASSWORD_ROUNDS
    ).hex()
    return f"{PASSWORD_ROUNDS}${salt}${digest}"


def password_matches(password, stored):
    try:
        rounds, salt, digest = stored.split("$")
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(rounds)
        ).hex()
        return hmac.compare_digest(actual, digest)
    except (ValueError, AttributeError):
        return False


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def validate_workspace(w):
    if not isinstance(w, dict) or w.get("version") != 1:
        raise APIError("The workspace format is invalid.")
    if not isinstance(w.get("settings"), dict) or not isinstance(w.get("water"), dict):
        raise APIError("The workspace settings are invalid.")
    for k in ("coach", "club"):
        text(w["settings"].get(k), k, 80)
    email(w["settings"].get("email"))
    ids = {}
    for key in COLLECTIONS:
        items = w.get(key)
        if not isinstance(items, list) or len(items) > 25000:
            raise APIError(f"The {key} list is invalid or too large.")
        ids[key] = set()
        for item in items:
            if not isinstance(item, dict):
                raise APIError(f"Invalid entry in {key}.")
            item_id = text(item.get("id"), "record ID", 100)
            if not re.fullmatch(r"[a-zA-Z0-9_-]+", item_id) or item_id in ids[key]:
                raise APIError(
                    "Record IDs must be unique and use letters, digits, underscores or hyphens."
                )
            ids[key].add(item_id)
    for c in w["clients"]:
        text(c.get("name"), "client name", 80)
        email(c.get("email"))
        if c.get("colour") not in ("warm", "blue", "sage", "lilac", "pink", ""):
            raise APIError("Invalid client colour.")
        if c.get("programme") and c["programme"] not in ids["programmes"]:
            raise APIError("The assigned programme does not exist.")
        if not isinstance(c.get("notes"), list) or not isinstance(
            c.get("targets"), dict
        ):
            raise APIError("Invalid client notes or nutrition targets.")
        for n in c["notes"]:
            text(n.get("text"), "coach note", 2000)
            date(n.get("date"))
        if c.get("checkin") is not None:
            text(c["checkin"], "check-in", 2000, optional=True)
        for k in ("calories", "protein", "carbs", "fat"):
            number(c["targets"].get(k), k, 1, 10000)
    if len({c["email"].lower() for c in w["clients"]}) != len(w["clients"]):
        raise APIError("Client email addresses must be unique.")
    for p in w["programmes"]:
        text(p.get("name"), "programme name", 80)
        text(p.get("description"), "programme description", 300)
        number(p.get("weeks"), "programme duration", 1, 52)
        number(p.get("frequency"), "sessions per week", 1, 7)
        if p.get("colour") not in ("", "dark", "light", "slate", "sage", "stone"):
            raise APIError("Invalid programme colour.")
        if (
            not isinstance(p.get("exercises"), list)
            or not 1 <= len(p["exercises"]) <= 100
        ):
            raise APIError("Choose at least one exercise.")
        for e in p["exercises"]:
            if e.get("id") not in ids["exercises"]:
                raise APIError("A programme exercise does not exist.")
            text(e.get("sets"), "exercise prescription", 80)
    for e in w["exercises"]:
        text(e.get("name"), "exercise name", 80)
        text(e.get("equipment"), "equipment", 60)
        text(e.get("prescription"), "exercise prescription", 40)
        if not isinstance(e.get("cues"), list) or not 1 <= len(e["cues"]) <= 30:
            raise APIError("Add coaching cues for this exercise.")
        for cue in e["cues"]:
            text(cue, "coaching cue", 2000)
    for key in ("logs", "measures", "meals"):
        for item in w[key]:
            if item.get("client") not in ids["clients"]:
                raise APIError("A record references a missing client.")
            date(item.get("date"))
    for m in w["measures"]:
        if m.get("kind") not in ("Deadlift", "Body weight", "2 km row"):
            raise APIError("Invalid measurement type.")
        number(m.get("value"), "result", 0.1, 10000)
    for m in w["meals"]:
        text(m.get("name"), "meal name", 120)
        for k in ("calories", "protein", "carbs", "fat"):
            number(m.get(k), k)
    for s in w["sessions"]:
        text(s.get("name"), "session name", 80)
        date(s.get("date"))
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", str(s.get("time"))):
            raise APIError("Invalid session time.")
        if (
            not isinstance(s.get("clients"), list)
            or not 1 <= len(set(s["clients"])) <= 6
            or any(cid not in ids["clients"] for cid in s["clients"])
        ):
            raise APIError("Choose 1 to 6 members for a session.")
        number(s.get("duration"), "duration", 10, 240)
    for value in w["water"].values():
        number(value, "water count", 0, 200)
    return w


def analytics(w):
    """Calculate adherence and streaks from actual saved training sessions."""
    now = dt.date.fromisoformat(today())
    monday = now - dt.timedelta(days=now.weekday())
    for c in w["clients"]:
        days = [
            dt.date.fromisoformat(l["date"])
            for l in w["logs"]
            if l["client"] == c["id"]
        ]
        p = next((p for p in w["programmes"] if p["id"] == c.get("programme")), None)
        completed = sum(monday <= d <= now for d in days)
        c["adherence"] = min(100, round(completed / (p["frequency"] if p else 3) * 100))
        weeks = {d - dt.timedelta(days=d.weekday()) for d in days if d <= now}
        cursor = monday if monday in weeks else monday - dt.timedelta(days=7)
        streak = 0
        while cursor in weeks:
            streak += 1
            cursor -= dt.timedelta(days=7)
        c["streak"] = streak
    return w


class AppServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, data_dir=None, public_origin="", setup_token=""):
        self.data_dir = Path(
            data_dir or os.environ.get("STC_DATA_DIR", ROOT / ".data")
        ).resolve()
        self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.video_dir = self.data_dir / "videos"
        self.video_dir.mkdir(exist_ok=True, mode=0o700)
        self.db_path = self.data_dir / "club.sqlite3"
        self.public_origin = public_origin.rstrip("/")
        self.setup_token = setup_token
        if self.public_origin and not self.public_origin.startswith("https://"):
            raise ValueError("STC_PUBLIC_ORIGIN must be an HTTPS origin.")
        self.local_setup = (
            address[0] in ("127.0.0.1", "localhost") and not self.public_origin
        )
        self.attempts = {}
        self.attempt_lock = threading.Lock()
        self.dummy_password = password_hash(secrets.token_urlsafe(24))
        with self.db() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(
                """
              CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,client TEXT,name TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
              CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,revision INTEGER NOT NULL);
              CREATE TABLE IF NOT EXISTS invitations(token TEXT PRIMARY KEY,client TEXT NOT NULL,expires INTEGER NOT NULL);
              CREATE TABLE IF NOT EXISTS videos(exercise TEXT PRIMARY KEY,file TEXT NOT NULL,mime TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS events(user TEXT NOT NULL,key TEXT NOT NULL,PRIMARY KEY(user,key));
            """
            )
        os.chmod(self.db_path, 0o600)
        super().__init__(address, Handler)

    def db(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    def workspace(self, db):
        row = db.execute("SELECT data,revision FROM workspace WHERE id=1").fetchone()
        if not row:
            raise APIError("Set up your club first.", 409)
        return json.loads(row["data"]), row["revision"]

    def view(self, user, w):
        w = analytics(copy.deepcopy(w))
        if user["role"] == "coach":
            return w
        cid = user["client"]
        own = next((c for c in w["clients"] if c["id"] == cid), None)
        if not own:
            raise APIError("This client account is no longer available.", 403)
        own["notes"] = []
        w["clients"] = [own]
        w["programmes"] = [
            p for p in w["programmes"] if p["id"] == own.get("programme")
        ]
        for k in ("logs", "meals", "measures"):
            w[k] = [r for r in w[k] if r["client"] == cid]
        w["sessions"] = [
            dict(
                s, clients=[cid], attended=[cid] if cid in s.get("attended", []) else []
            )
            for s in w["sessions"]
            if cid in s["clients"]
        ]
        w["water"] = {k: v for k, v in w["water"].items() if k.startswith(cid + "-")}
        w["activity"] = []
        w["settings"] = {k: w["settings"][k] for k in ("club", "coach")}
        w["readNotifications"] = []
        return w


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def log_message(self, fmt, *args):
        # Never log invite tokens, query strings, passwords or request bodies.
        pass

    def json(self, value, status=200, headers=None):
        body = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.security_headers()
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        )
        if self.server.public_origin:
            self.send_header("Strict-Transport-Security", "max-age=31536000")

    def body(self, limit=MAX_JSON):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise APIError("Invalid request length.")
        if length < 0 or length > limit:
            raise APIError("That upload is too large.", 413)
        raw = self.rfile.read(length)
        if len(raw) != length:
            raise APIError("Incomplete request.")
        return raw

    def read_json(self):
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            raise APIError("Send this request as JSON.", 415)
        try:
            value = json.loads(self.body())
        except (ValueError, UnicodeDecodeError):
            raise APIError("Invalid JSON request.")
        if not isinstance(value, dict):
            raise APIError("Invalid request body.")
        return value

    def origin(self):
        expected = self.server.public_origin or "http://" + self.headers.get("Host", "")
        if not self.server.public_origin:
            host = urlsplit(expected).hostname
            if host not in ("localhost", "127.0.0.1") and self.server.local_setup:
                raise APIError("Invalid request host.", 403)
        supplied = self.headers.get("Origin")
        if supplied and supplied != expected:
            raise APIError("This request came from another website.", 403)
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            raise APIError("Cross-site request refused.", 403)

    def auth(self, db, coach=False, write=False):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            raise APIError("Please sign in.", 401)
        token = cookies.get(COOKIE)
        if not token:
            raise APIError("Please sign in.", 401)
        row = db.execute(
            "SELECT users.*,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user WHERE sessions.token=? AND sessions.expires>?",
            (token_hash(token.value), int(time.time())),
        ).fetchone()
        if not row:
            raise APIError("Please sign in again.", 401)
        if coach and row["role"] != "coach":
            raise APIError("This action is for your coach.", 403)
        if write:
            self.origin()
            if not hmac.compare_digest(
                self.headers.get("X-CSRF-Token", ""), row["csrf"]
            ):
                raise APIError("Refresh the page and try again.", 403)
        return dict(row)

    def session(self, db, uid):
        raw, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        db.execute("DELETE FROM sessions WHERE expires<=?", (int(time.time()),))
        db.execute(
            "INSERT INTO sessions VALUES(?,?,?,?)",
            (token_hash(raw), uid, csrf, int(time.time()) + 7 * 86400),
        )
        cookie = f"{COOKIE}={raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800"
        if self.server.public_origin:
            cookie += "; Secure"
        return {"Set-Cookie": cookie}

    def public_user(self, user):
        return {k: user[k] for k in ("id", "email", "name", "role", "client")}

    def limit_login(self, account):
        now = time.time()
        keys = ("ip:" + self.client_address[0], "account:" + account)
        with self.server.attempt_lock:
            self.server.attempts = {
                k: [t for t in v if t > now - 900]
                for k, v in self.server.attempts.items()
                if any(t > now - 900 for t in v)
            }
            if (
                len(self.server.attempts.get(keys[0], [])) >= 100
                or len(self.server.attempts.get(keys[1], [])) >= 10
            ):
                raise APIError("Too many attempts. Try again in 15 minutes.", 429)
            for k in keys:
                self.server.attempts.setdefault(k, []).append(now)

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_HEAD(self):
        self.dispatch("HEAD")

    def dispatch(self, method):
        try:
            path = unquote(urlsplit(self.path).path)
            if path.startswith("/api/"):
                self.api(method, path)
            elif method in ("GET", "HEAD"):
                self.static(path, method == "HEAD")
            else:
                raise APIError("Not found.", 404)
        except APIError as error:
            self.close_connection = True
            self.json({"error": error.message}, error.status)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.json(
                {
                    "error": "The server could not complete this request. Please try again."
                },
                500,
            )

    def api(self, method, path):
        with self.server.db() as db:
            if method == "GET" and path == "/api/health":
                db.execute("SELECT 1")
                return self.json({"status": "ok"})
            if method == "GET" and path == "/api/auth/status":
                setup = not db.execute(
                    "SELECT 1 FROM users WHERE role='coach'"
                ).fetchone()
                try:
                    user = self.auth(db)
                except APIError:
                    return self.json(
                        {
                            "authenticated": False,
                            "setup": setup,
                            "setupTokenRequired": not self.server.local_setup,
                        }
                    )
                return self.json(
                    {
                        "authenticated": True,
                        "user": self.public_user(user),
                        "csrf": user["csrf"],
                    }
                )
            if method == "POST" and path == "/api/auth/setup":
                self.origin()
                body = self.read_json()
                if not self.server.local_setup and (
                    not self.server.setup_token
                    or not hmac.compare_digest(
                        str(body.get("setupToken", "")), self.server.setup_token
                    )
                ):
                    raise APIError(
                        "Enter the setup code from your hosting settings.", 403
                    )
                hashed = password_hash(body.get("password"))
                address = email(body.get("email"))
                name = text(body.get("name"), "coach name", 80)
                workspace = validate_workspace(body.get("workspace"))
                workspace["settings"].update(coach=name, email=address)
                uid = secrets.token_hex(16)
                db.execute("BEGIN IMMEDIATE")
                if db.execute("SELECT 1 FROM users WHERE role='coach'").fetchone():
                    raise APIError("This club is already set up. Sign in instead.", 409)
                db.execute(
                    "INSERT INTO users VALUES(?,?,?,?,?,?)",
                    (uid, address, hashed, "coach", None, name),
                )
                db.execute(
                    "INSERT INTO workspace VALUES(1,?,1)", (json.dumps(workspace),)
                )
                headers = self.session(db, uid)
                db.commit()
                return self.json({"ok": True}, 201, headers)
            if method == "POST" and path == "/api/auth/login":
                self.origin()
                body = self.read_json()
                address = email(body.get("email"))
                pw = text(body.get("password"), "password", 512)
                self.limit_login(address)
                user = db.execute(
                    "SELECT * FROM users WHERE email=?", (address,)
                ).fetchone()
                valid = password_matches(
                    pw, user["password"] if user else self.server.dummy_password
                )
                if not user or not valid:
                    raise APIError("Email or password did not match.", 401)
                with self.server.attempt_lock:
                    self.server.attempts.pop("account:" + address, None)
                headers = self.session(db, user["id"])
                db.commit()
                return self.json({"ok": True}, headers=headers)
            if method == "GET" and path.startswith("/api/invitations/"):
                row = db.execute(
                    "SELECT client FROM invitations WHERE token=? AND expires>?",
                    (token_hash(path.rsplit("/", 1)[-1]), int(time.time())),
                ).fetchone()
                if not row:
                    raise APIError(
                        "This link has expired or has already been used. Ask your coach for a new one.",
                        410,
                    )
                w, _ = self.server.workspace(db)
                c = next((c for c in w["clients"] if c["id"] == row["client"]), None)
                if not c:
                    raise APIError("This invitation is no longer available.", 410)
                return self.json(
                    {
                        "name": c["name"],
                        "email": c["email"],
                        "club": w["settings"]["club"],
                    }
                )
            if method == "POST" and path == "/api/auth/accept":
                self.origin()
                body = self.read_json()
                hashed = password_hash(body.get("password"))
                db.execute("BEGIN IMMEDIATE")
                row = db.execute(
                    "SELECT client FROM invitations WHERE token=? AND expires>?",
                    (token_hash(str(body.get("token", ""))), int(time.time())),
                ).fetchone()
                if not row:
                    raise APIError(
                        "This invitation has expired or has already been used.", 410
                    )
                w, _ = self.server.workspace(db)
                c = next((c for c in w["clients"] if c["id"] == row["client"]), None)
                if not c:
                    raise APIError("This client no longer exists.", 410)
                existing = db.execute(
                    "SELECT * FROM users WHERE email=?", (c["email"].lower(),)
                ).fetchone()
                if existing and (
                    existing["role"] != "member" or existing["client"] != c["id"]
                ):
                    raise APIError(
                        "This email is already used by another account.", 409
                    )
                uid = existing["id"] if existing else secrets.token_hex(16)
                if existing:
                    db.execute("UPDATE users SET password=? WHERE id=?", (hashed, uid))
                    db.execute("DELETE FROM sessions WHERE user=?", (uid,))
                else:
                    db.execute(
                        "INSERT INTO users VALUES(?,?,?,?,?,?)",
                        (uid, c["email"].lower(), hashed, "member", c["id"], c["name"]),
                    )
                db.execute("DELETE FROM invitations WHERE client=?", (c["id"],))
                headers = self.session(db, uid)
                db.commit()
                return self.json({"ok": True}, 201, headers)
            write = method not in ("GET", "HEAD")
            user = self.auth(db, write=write)
            if method == "POST" and path == "/api/auth/logout":
                cookies = SimpleCookie(self.headers.get("Cookie", ""))
                db.execute(
                    "DELETE FROM sessions WHERE token=?",
                    (token_hash(cookies[COOKIE].value),),
                )
                db.commit()
                return self.json(
                    {"ok": True},
                    headers={
                        "Set-Cookie": f"{COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
                        + ("; Secure" if self.server.public_origin else "")
                    },
                )
            if method == "POST" and path == "/api/password":
                body = self.read_json()
                if not password_matches(
                    text(body.get("current"), "current password", 512), user["password"]
                ):
                    raise APIError("Your current password did not match.", 403)
                hashed = password_hash(body.get("password"))
                db.execute(
                    "UPDATE users SET password=? WHERE id=?", (hashed, user["id"])
                )
                db.execute(
                    "DELETE FROM sessions WHERE user=? AND csrf<>?",
                    (user["id"], user["csrf"]),
                )
                db.commit()
                return self.json({"ok": True})
            if method == "GET" and path == "/api/workspace":
                w, revision = self.server.workspace(db)
                return self.json(
                    {"workspace": self.server.view(user, w), "revision": revision}
                )
            if method == "PUT" and path == "/api/workspace":
                if user["role"] != "coach":
                    raise APIError("Only your coach can edit the workspace.", 403)
                body = self.read_json()
                w = validate_workspace(body.get("workspace"))
                db.execute("BEGIN IMMEDIATE")
                old, revision = self.server.workspace(db)
                if body.get("revision") != revision:
                    raise APIError(
                        "Another update arrived. Your workspace has been refreshed; please retry your change.",
                        409,
                    )
                linked = db.execute(
                    "SELECT client,email FROM users WHERE role='member'"
                ).fetchall()
                for account in linked:
                    c = next(
                        (c for c in w["clients"] if c["id"] == account["client"]), None
                    )
                    if not c or c["email"].lower() != account["email"]:
                        raise APIError(
                            "Keep existing account records and their email addresses.",
                            409,
                        )
                # Video status is authoritative on the server, never an arbitrary browser flag.
                video_ids = {
                    r["exercise"] for r in db.execute("SELECT exercise FROM videos")
                }
                for ex in w["exercises"]:
                    ex["video"] = ex["id"] in video_ids
                db.execute(
                    "UPDATE workspace SET data=?,revision=revision+1 WHERE id=1",
                    (json.dumps(w),),
                )
                db.commit()
                return self.json(
                    {"workspace": self.server.view(user, w), "revision": revision + 1}
                )
            if method == "POST" and path == "/api/invitations":
                if user["role"] != "coach":
                    raise APIError("Only your coach can create invitations.", 403)
                body = self.read_json()
                w, _ = self.server.workspace(db)
                c = next(
                    (c for c in w["clients"] if c["id"] == body.get("client")), None
                )
                if not c:
                    raise APIError("Choose a valid client.")
                raw = secrets.token_urlsafe(32)
                expires = int(time.time()) + 72 * 3600
                db.execute("DELETE FROM invitations WHERE client=?", (c["id"],))
                db.execute(
                    "INSERT INTO invitations VALUES(?,?,?)",
                    (token_hash(raw), c["id"], expires),
                )
                db.commit()
                return self.json({"token": raw, "expires": expires}, 201)
            if method == "POST" and path == "/api/member/actions":
                if user["role"] != "member":
                    raise APIError("Sign in as a member to use this action.", 403)
                body = self.read_json()
                db.execute("BEGIN IMMEDIATE")
                w, revision = self.server.workspace(db)
                key = text(body.get("key"), "action ID", 100)
                if db.execute(
                    "SELECT 1 FROM events WHERE user=? AND key=?", (user["id"], key)
                ).fetchone():
                    return self.json(
                        {"workspace": self.server.view(user, w), "revision": revision}
                    )
                self.member_action(w, user, body)
                validate_workspace(w)
                db.execute(
                    "UPDATE workspace SET data=?,revision=revision+1 WHERE id=1",
                    (json.dumps(w),),
                )
                db.execute("INSERT INTO events VALUES(?,?)", (user["id"], key))
                db.commit()
                return self.json(
                    {"workspace": self.server.view(user, w), "revision": revision + 1}
                )
            if method == "GET" and path == "/api/leaderboard":
                w, _ = self.server.workspace(db)
                analytics(w)
                monday = dt.date.fromisoformat(today())
                monday -= dt.timedelta(days=monday.weekday())
                rows = []
                for c in w["clients"]:
                    if (
                        user["role"] != "coach"
                        and not c.get("leaderboardOptIn")
                        and c["id"] != user["client"]
                    ):
                        continue
                    row = {
                        "id": c["id"],
                        "name": c["name"].split()[0]
                        + (
                            " " + c["name"].split()[-1][0] + "."
                            if len(c["name"].split()) > 1
                            else ""
                        ),
                        "sessions": sum(
                            l["client"] == c["id"]
                            and monday.isoformat() <= l["date"] <= today()
                            for l in w["logs"]
                        ),
                        "streak": c["streak"],
                        "adherence": c["adherence"],
                    }
                    for kind, key in [("Deadlift", "deadlift"), ("2 km row", "row")]:
                        results = sorted(
                            [
                                m
                                for m in w["measures"]
                                if m["client"] == c["id"] and m["kind"] == kind
                            ],
                            key=lambda m: m["date"],
                        )
                        row[key] = results[-1]["value"] if results else None
                    rows.append(row)
                return self.json({"rows": rows})
            if path.startswith("/api/videos/"):
                eid = path.rsplit("/", 1)[-1]
                if method == "POST":
                    return self.upload_video(db, user, eid)
                if method in ("GET", "HEAD"):
                    return self.video(db, eid, method == "HEAD")
            raise APIError("Not found.", 404)

    def member_action(self, w, user, body):
        cid = user["client"]
        c = next((c for c in w["clients"] if c["id"] == cid), None)
        if not c:
            raise APIError("This account is no longer available.", 403)
        action = body.get("action")
        record_id = secrets.token_hex(16)
        if action == "workout":
            p = next(
                (p for p in w["programmes"] if p["id"] == c.get("programme")), None
            )
            if not p:
                raise APIError("Your coach has not assigned a programme yet.", 409)
            completed = body.get("completed", [])
            if not isinstance(completed, list) or set(completed) != {
                e["id"] for e in p["exercises"]
            }:
                raise APIError(
                    "Mark every exercise complete before logging this session."
                )
            entries = body.get("entries", [])
            if not isinstance(entries, list) or len(entries) > 100:
                raise APIError("Invalid training log.")
            for entry in entries:
                if (
                    not isinstance(entry, dict)
                    or entry.get("exercise") not in completed
                ):
                    raise APIError("Invalid exercise in training log.")
                number(entry.get("weight"), "working load", 0, 1000)
                number(entry.get("reps"), "reps", 1, 1000)
            w["logs"].append(
                {
                    "id": record_id,
                    "client": cid,
                    "date": today(),
                    "type": "Programme session",
                    "programme": p["id"],
                    "entries": entries,
                }
            )
            w["activity"].insert(
                0,
                {
                    "id": secrets.token_hex(16),
                    "title": c["name"].split()[0] + " completed a session",
                    "text": p["name"] + " · Another step forward.",
                    "date": today(),
                    "icon": "checkCircle",
                    "tone": "green",
                },
            )
        elif action == "meal":
            meal = {
                "id": record_id,
                "client": cid,
                "date": today(),
                "name": text(body.get("name"), "meal name", 120),
                "type": text(body.get("type"), "meal type", 30),
            }
            for k in ("calories", "protein", "carbs", "fat"):
                meal[k] = number(body.get(k), k)
            w["meals"].append(meal)
        elif action == "water":
            key = cid + "-" + today()
            w["water"][key] = min(200, w["water"].get(key, 0) + 1)
        elif action == "result":
            kind = body.get("kind")
            if kind not in ("Deadlift", "Body weight", "2 km row"):
                raise APIError("Choose a valid measurement.")
            value = number(body.get("value"), "result", 0.1, 10000)
            if kind == "2 km row" and value != int(value):
                raise APIError("Use whole seconds for your rowing time.")
            w["measures"].append(
                {
                    "id": record_id,
                    "client": cid,
                    "kind": kind,
                    "value": value,
                    "date": date(body.get("date"), False),
                }
            )
        elif action == "checkin":
            c["checkin"] = text(body.get("text"), "check-in", 2000)
            c["status"] = "Needs attention"
            w["activity"].insert(
                0,
                {
                    "id": record_id,
                    "title": c["name"].split()[0] + " checked in",
                    "text": "A few words for their coach.",
                    "date": today(),
                    "icon": "message",
                    "tone": "",
                },
            )
        elif action == "privacy":
            if not isinstance(body.get("optIn"), bool):
                raise APIError("Choose a valid privacy preference.")
            c["leaderboardOptIn"] = body["optIn"]
        else:
            raise APIError("Unknown client action.")
        w["activity"] = w["activity"][:30]

    def upload_video(self, db, user, eid):
        if user["role"] != "coach":
            raise APIError("Only your coach can upload exercise videos.", 403)
        mime = self.headers.get("Content-Type", "").split(";")[0]
        if mime not in ("video/mp4", "video/webm", "video/ogg", "video/quicktime"):
            raise APIError("Choose MP4, WebM, Ogg or MOV.", 415)
        raw = self.body(MAX_VIDEO)
        if not raw or not (
            raw[:4] in (b"\x1aE\xdf\xa3", b"OggS")
            or raw[4:8] in (b"ftyp", b"moov", b"wide")
        ):
            raise APIError("This file does not look like a supported video.", 415)
        db.execute("BEGIN IMMEDIATE")
        w, revision = self.server.workspace(db)
        ex = next((e for e in w["exercises"] if e["id"] == eid), None)
        if not ex:
            raise APIError("Exercise not found.", 404)
        filename = secrets.token_hex(24) + ".video"
        target = self.server.video_dir / filename
        old = db.execute("SELECT file FROM videos WHERE exercise=?", (eid,)).fetchone()
        try:
            target.write_bytes(raw)
            os.chmod(target, 0o600)
            db.execute(
                "INSERT OR REPLACE INTO videos VALUES(?,?,?)", (eid, filename, mime)
            )
            ex["video"] = True
            db.execute(
                "UPDATE workspace SET data=?,revision=revision+1 WHERE id=1",
                (json.dumps(w),),
            )
            db.commit()
        except Exception:
            target.unlink(missing_ok=True)
            raise
        if old:
            (self.server.video_dir / old["file"]).unlink(missing_ok=True)
        return self.json(
            {"workspace": self.server.view(user, w), "revision": revision + 1}
        )

    def video(self, db, eid, head=False):
        row = db.execute(
            "SELECT file,mime FROM videos WHERE exercise=?", (eid,)
        ).fetchone()
        if not row:
            raise APIError("Video not found.", 404)
        path = self.server.video_dir / row["file"]
        size = path.stat().st_size
        start, end, status = 0, size - 1, 200
        rng = self.headers.get("Range")
        if rng:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", rng)
            if not match or not any(match.groups()):
                raise APIError("Invalid video range.", 416)
            a, b = match.groups()
            if not a:
                start = max(0, size - int(b))
            else:
                start = int(a)
                end = min(size - 1, int(b)) if b else size - 1
            if start >= size or end < start:
                raise APIError("Video range is outside the file.", 416)
            status = 206
        self.send_response(status)
        self.send_header("Content-Type", row["mime"])
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "private, no-store")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.security_headers()
        self.end_headers()
        if not head:
            with path.open("rb") as f:
                f.seek(start)
                left = end - start + 1
                while left:
                    chunk = f.read(min(left, 64 * 1024))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)

    def static(self, path, head=False):
        relative = path.lstrip("/") or "index.html"
        target = (ROOT / relative).resolve()
        if (
            not target.is_relative_to(ROOT)
            or not target.is_file()
            or not (
                relative in STATIC
                or (
                    relative.startswith("assets/")
                    and target.is_relative_to(ROOT / "assets")
                )
            )
        ):
            raise APIError("Not found.", 404)
        body = target.read_bytes()
        self.send_response(200)
        self.send_header(
            "Content-Type",
            mimetypes.guess_type(str(target))[0] or "application/octet-stream",
        )
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.security_headers()
        self.end_headers()
        if not head:
            self.wfile.write(body)
