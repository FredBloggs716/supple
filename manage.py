#!/usr/bin/env python3
"""Reset a coach password on the server without exposing it in arguments."""
import argparse
import getpass
import os
from pathlib import Path
import sqlite3
from server import ROOT, password_hash, APIError


def main():
    parser = argparse.ArgumentParser(description="Reset your coach password")
    parser.add_argument(
        "--data-dir", default=os.environ.get("STC_DATA_DIR", str(ROOT / ".data"))
    )
    args = parser.parse_args()
    path = Path(args.data_dir) / "club.sqlite3"
    if not path.is_file():
        parser.exit(1, "No club database found in that folder.\n")
    with sqlite3.connect(path) as db:
        coach = db.execute("SELECT id FROM users WHERE role='coach'").fetchone()
        if not coach:
            parser.exit(1, "Create your coach account in the app first.\n")
        password = getpass.getpass("New coach password (at least 12 characters): ")
        if password != getpass.getpass("Repeat password: "):
            parser.exit(1, "Passwords did not match.\n")
        try:
            hashed = password_hash(password)
        except APIError as error:
            parser.exit(1, error.message + "\n")
        db.execute("UPDATE users SET password=? WHERE id=?", (hashed, coach[0]))
        db.execute("DELETE FROM sessions WHERE user=?", (coach[0],))
    print("Coach password updated. Sign in again on your devices.")


if __name__ == "__main__":
    main()
