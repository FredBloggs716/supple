#!/usr/bin/env python3
"""Start Social Training Club from any working directory."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser


def main():
    parser = argparse.ArgumentParser(description='Start Social Training Club')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('--port must be between 1 and 65535')
    app_dir = Path(__file__).resolve().parent
    if not (app_dir / 'index.html').is_file():
        parser.error('The app files are missing. Extract the entire ZIP before starting.')
    handler = partial(SimpleHTTPRequestHandler, directory=str(app_dir))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(1, f'Could not start on port {args.port}: {error}\nTry another port: python3 start.py --port 8001\n')
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Social Training Club is running at {url}', flush=True)
    print('Keep this window open. Press Ctrl+C to stop.', flush=True)
    timer = None
    if not args.no_browser:
        timer = threading.Timer(0.4, webbrowser.open, args=(url,))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nSocial Training Club stopped.')
    finally:
        if timer:
            timer.cancel()
        server.server_close()


if __name__ == '__main__':
    main()
