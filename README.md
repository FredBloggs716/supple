# Social Training Club

A working coach and client web app using the supplied Social Training Club design. Includes account sign-in, a shared SQLite database and private exercise videos. Built with HTML, CSS, native JavaScript and Python 3.10+; no npm installation or application build is needed.

## Run on your computer

Download this repository with GitHub **Code → Download ZIP**, extract it, and install Python 3.10 or newer.

- Windows: double-click **Start app.bat**.
- macOS: double-click **Start app.command**, or run `python3 start.py` in the extracted folder.
- Linux: run `python3 start.py` in the project folder.

The launcher opens your browser. Keep its terminal open; Ctrl+C stops the app. If port 8000 is occupied, run `python3 start.py --port 8001`. Use this launcher: a plain static file server cannot run accounts or save shared records.

Create your coach account on the first screen. Leave **Start with fictional sample clients** unchecked for a fresh club, or check it to explore sample records. Add a client, assign a programme, open their profile and choose **Create sign-in link**. Share the link directly with that client. They set their password and enter their own workspace.

Local invitation links work only on the computer running the app. To let clients sign in from their own devices, host the app as below.

## Put it online

This repository includes a [Render Blueprint](render.yaml) with a persistent database/video disk. It uses Render's **paid Starter plan**; review the hosting price before creating the service. No hosting purchase or deployment has been made for you.

1. Sign in to [Render](https://render.com), choose **New → Blueprint**, and connect `FredBloggs716/supple`.
2. Review and create the service. Render installs the app and provides its HTTPS address.
3. Open that address. In Render's service **Environment** settings, find the generated `STC_SETUP_TOKEN` and use it as the setup code when creating your coach account. Keep this value private.
4. Add clients and send their private invitation links. The hosted address works on phones and computers.

Render supplies the public HTTPS origin automatically. For a custom domain, set `STC_PUBLIC_ORIGIN` to the exact HTTPS origin, such as `https://training.example.com`, without a path. Keep one running app instance attached to its persistent disk. Free services with ephemeral storage will lose the database and videos.

Other hosts can run `python3 start.py --host 0.0.0.0 --no-browser` behind an HTTPS reverse proxy. Configure `PORT`, `STC_DATA_DIR`, `STC_PUBLIC_ORIGIN` and a randomly generated `STC_SETUP_TOKEN`. The proxy should support video uploads up to 50 MB. See [.env.example](.env.example) for variable names; the app reads process environment variables, not an `.env` file.

## Included workflows

- Coach dashboard: actual attendance, programme adherence, training streaks, activity and check-in review.
- Client management: programme assignment, nutrition targets, private notes, invitation links and recent workout loads/reps.
- Programmes: create repeatable sessions, select exercises, assign clients and log completed training.
- Client portal: prescribed workouts, load/reps logging, technique guides, nutrition, water, progress charts and coach check-ins.
- Nutrition: individual calorie and macro targets, meal logging and daily water tracking.
- Exercise library: search, coaching cues, new exercises and private video upload/playback.
- Progress: deadlift, body weight and 2 km row results and personal charts.
- Calendar: individual/group sessions and per-client attendance; prevents completing future or already completed sessions.
- Gamification: 50 XP per completed session, attendance/benchmark rankings, weekly club goals and attendance-based trainer of the week.
- Client leaderboard consent: other clients see only opted-in members' first name/last initial, attendance and training benchmarks. Body weight, nutrition and coach notes stay private.
- Account settings: password changes, sign-out, workspace export and coach password recovery.

## Accounts and storage

This release supports one coach account and separate client accounts for one club. Clients can access only their own records and their assigned programme; they can browse the club's exercise library. Coach notes are excluded from client API responses. Sign-in uses salted PBKDF2 password hashes, HttpOnly session cookies, CSRF/origin checks and login rate limiting. Hosting uses secure cookies over HTTPS. Updates include a revision check to prevent silently overwriting concurrent changes.

Invitations expire after 72 hours and work once. A new invitation replaces older unused invitations for that client. For an existing client account, accepting a new invitation resets its password and signs out previous sessions. Invitations are created in the app; email/SMS delivery is not integrated.

By default, accounts, records and videos are saved in `.data/` beside the app. Configure `STC_DATA_DIR` for a persistent hosting volume. Files in this folder are excluded from Git and cannot be served through the app's static routes. Browser data clearing does not remove server records. Both workspaces refresh shared changes about every 20 seconds when idle; reload to refresh immediately.

Back up the **entire data folder**, including videos, while the app is stopped, or use SQLite's backup API for an online database backup. JSON export includes structured coaching records, not passwords, account sessions or video files; it is not a complete restore backup. To restore, stop the server and replace its data folder with the full backup.

If you forget your coach password, run `python3 manage.py` on the server, or add `--data-dir /path/to/data`. It prompts privately for a new password and invalidates existing coach sessions. The account's sign-in email is the address used at creation; the email in coach workspace settings is a contact address.

The earlier browser-only prototype's localStorage and IndexedDB records are not automatically imported. They are left untouched. Export any old records before replacing that version.

## Current scope

Programmes are repeatable session templates with duration and weekly frequency. Workout logging records a working load and reps for each exercise; separate records for every set, per-week progression and editing existing templates are future additions. The app does not yet include billing, messaging threads, automated reminders, food database lookup, multiple coach teams or wearable integrations.

Calendars and daily nutrition use Europe/London. Weekly attendance resets on Monday; ties use adherence. Streaks and adherence are computed from saved sessions. Latest saved benchmark results drive rankings. Exercise videos accept MP4, WebM, Ogg or MOV up to 50 MB; playback depends on browser codec support. No demonstration videos are bundled.

## Design and validation

The supplied STC logos, navy/red palette, Outfit headings, DM Sans body text and cool neutrals are used throughout. Fonts are bundled locally with their licenses; the app makes no third-party requests at runtime.

Server integration checks use temporary databases and cover sign-in, one-use invitations, client isolation, CSRF, blocked private files, conflicting writes, idempotent client logs, video access/ranges, password changes, login limits and persistence after restart:

```sh
python3 -m unittest discover -s tests -p 'test_server.py'
```

This test fixture uses Node to generate fictional seed records; the app itself does not need Node.

Browser checks require Python Playwright and Chromium. They start a temporary server and cover both workspaces, real video playback, accounts, shared records, privacy consent and desktop/mobile layouts:

```sh
python3 tests/smoke.py
python3 tests/onboarding_smoke.py
```

Set `STC_CHROMIUM` to your Chromium executable if it is not `/usr/bin/chromium`. Neither suite touches a running club's database.
