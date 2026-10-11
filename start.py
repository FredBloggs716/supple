#!/usr/bin/env python3
"""Start the full Social Training Club app from any working directory."""
import argparse
import os
import threading
import webbrowser
from server import AppServer


def main():
    parser = argparse.ArgumentParser(description="Start Social Training Club")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    parser.add_argument("--host", default=os.environ.get("STC_HOST", "127.0.0.1"))
    parser.add_argument("--data-dir", default=os.environ.get("STC_DATA_DIR"))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    try:
        server = AppServer(
            (args.host, args.port),
            args.data_dir,
            os.environ.get(
                "STC_PUBLIC_ORIGIN", os.environ.get("RENDER_EXTERNAL_URL", "")
            ),
            os.environ.get("STC_SETUP_TOKEN", ""),
        )
    except (OSError, ValueError) as error:
        parser.exit(1, f"Could not start: {error}\n")
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Social Training Club is running on port {server.server_port}.", flush=True)
    print("Keep this window open. Press Ctrl+C to stop.", flush=True)
    timer = None
    if not args.no_browser and args.host in ("127.0.0.1", "localhost"):
        timer = threading.Timer(0.4, webbrowser.open, args=(url,))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSocial Training Club stopped.")
    finally:
        if timer:
            timer.cancel()
        server.server_close()


if __name__ == "__main__":
    main()
