# Social Training Club

A responsive personal training workspace based on the supplied Social Training Club design handoff. Built with native JavaScript modules, HTML and CSS; there are no application dependencies or build steps.

## Run

Extract the entire downloadable ZIP first. Python 3 must be installed.

- Windows: double-click `Start app.bat`.
- macOS: double-click `Start app.command`. If macOS blocks the launcher, open a terminal in the extracted folder and run `python3 start.py`.
- Linux: open a terminal in the extracted folder and run `python3 start.py`.

The launcher opens your browser and always serves the application folder, even when started from another working directory. Keep its terminal window open; press Ctrl+C to stop.

Alternatively, from any terminal, use the full path to `start.py`:

```sh
python3 /path/to/supple/start.py
```

If port 8000 is occupied, stop your earlier server or choose a different port with `python3 start.py --port 8001`.

For a manual server, explicitly point it at the app folder:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory /path/to/supple
```

The app is served on port 8000. Use an HTTP server rather than opening `index.html` directly, because the app uses JavaScript modules.

## What works

- Coach overview with club activity, attendance, programme adherence and pending check-ins.
- Client creation, programme assignment, private coaching notes and check-in review.
- Programme creation with exercise selection, repeatable weekly sessions and completed-workout logging.
- Client-specific nutrition targets, meal/macro logging and water tracking.
- Searchable exercise library with technique cues, new exercises and uploaded video playback.
- Individual progress charts and results for deadlift, body weight and 2 km rowing.
- Weekly calendar, individual/group session creation and per-member attendance.
- Attendance and benchmark leaderboards, 50 XP per completed session, a shared weekly goal and an attendance-based trainer-of-the-week award.
- Workspace search (`Ctrl/⌘ K`), notifications, coach settings and JSON data export.

## Data and scope

This is a functional local prototype, initially populated with 12 fictional clients and 6 programmes. All UI operations run locally. Structured data is saved under `stc-coach-v1` in localStorage; exercise videos are stored in the `stc-exercise-videos` IndexedDB database. The earlier SUPPLE app's `suppleQuest_v1` storage is not read or overwritten.

The app does not yet have authentication, a server database, client login portals, shared access, email delivery, billing or cloud video hosting. Do not treat local browser storage as a production store for client health information. Clearing browser data removes saved changes; JSON exports include structured records but not video files. No restore/import flow is implemented yet.

Nutrition entries use the current London calendar day. Calendars use Europe/London. Attendance ranks reset each Monday; a tie is broken by programme adherence. Benchmark ranks use the latest recorded result. Body weight is excluded from club rankings. Seeded adherence and historical streak fields are demonstration data, not computed programme analytics.

A programme is a repeatable session template, with a duration and weekly frequency. Exercise prescriptions come from the library; per-week progression and editing existing templates are future extensions. Scheduled sessions can only be marked complete on or after their date. They cannot be completed twice. Programme sessions can be logged repeatedly to reflect separate training sessions.

Exercise videos accept MP4, WebM, Ogg and MOV files up to 50 MB. Playback depends on the browser's codec support. No sample exercise videos are bundled; upload your own licensed demonstrations. Technique guides work without a video. Videos stay on the device and are not sent to external services.

## Design

The supplied logo assets, navy/red palette, Outfit headings, DM Sans body text, pill buttons and cool neutrals are carried through the app. Fonts are bundled locally, so no external requests are needed at runtime. Font packages came from Fontsource version 5.3.0 and were checked against npm's SHA-512 integrity metadata. Their licenses are in `assets/fonts/`. Logo assets are from the user's handoff. SVG icons use inline Lucide-style line geometry.

## Validate

With the server running, and Python Playwright plus Chromium installed:

```sh
python3 tests/smoke.py
```

Set `STC_TEST_URL` to use another server URL. The suite launches `/usr/bin/chromium` in a disposable browser context. It covers client and programme creation, notes, assignment, workout logging, nutrition, result rankings, calendar attendance, check-in review, search, real video upload/playback and persistence, settings, export, and all mobile routes. Test records never enter a normal browser profile.

Screenshots and test-created videos are not committed as app assets.
