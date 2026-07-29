"""Dev server for Mixology Merge. Use this instead of `python -m http.server`.

    python serve.py            # port 5500
    python serve.py 5501       # another port (parallel worktree, etc.)

The only thing this adds over the stdlib one-liner is a `Cache-Control: no-cache`
header, and that header is the whole point: without it the browser happily serves
a STALE config/*.js or game.js under an unchanged `?v=` cache-buster, so an edit
you just made appears not to have taken. That symptom is indistinguishable from a
real bug and has cost real time (see "Deploy checklist" in CLAUDE.md).

It does NOT affect what Mai gets. Nothing here is deployed or loaded by the game;
GitHub Pages serves the committed files with its own headers, and the `?v=`
bump in index.html is still what busts HER cache.

ThreadingHTTPServer is mandatory, not a nicety: a plain TCPServer has a listen
backlog of 5, while Chrome opens ~6 parallel connections, so page loads hang
half-finished and the rest fail with ERR_CONNECTION_REFUSED. That looked like
random preview flakiness for weeks (diagnosed 2026-07-12). `python -m http.server`
is already threaded on Python 3.7+, so that trap only bites hand-rolled servers.
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Default logs every 200; only surface what is actually worth seeing.
        if not args or not str(args[1] if len(args) > 1 else '').startswith('2'):
            super().log_message(fmt, *args)


def main():
    # Precedence: explicit argument, then $PORT, then 5500. $PORT matters because
    # the `game-worktree` launch config sets autoPort, and the harness hands the
    # port it picked to the process that way - ignoring it would send every
    # worktree back to 5500 and collide with the main checkout's server.
    port = int(os.environ.get('PORT') or 5500)
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            # Windows console is cp1252 - no arrows, dashes or emoji in output.
            print('Usage: python serve.py [port]')
            return 2
    try:
        srv = ThreadingHTTPServer(('', port), NoCacheHandler)
    except OSError as e:
        print('Could not bind port %d: %s' % (port, e))
        print('Something is already serving it - reuse that one, or pass another port.')
        return 1
    print('Mixology Merge dev server (no-cache) on http://localhost:%d' % port)
    print('Game:  http://localhost:%d/' % port)
    print('Tools: http://localhost:%d/tools/hitbox-editor.html' % port)
    print('Ctrl+C to stop.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
