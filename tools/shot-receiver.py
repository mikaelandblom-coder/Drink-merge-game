"""One-shot screenshot receiver for hidden-tab captures.

The reliable way to get a canvas screenshot out of the preview browser is to
POST the dataURL to a local receiver — returning big base64 strings through
the eval-result channel truncates/spills, and hand-copying base64 corrupts.

Usage:
    python tools/shot-receiver.py <outfile.png> [--port 5599] [--count 1]

Then, in the page (works even when the tab is hidden):
    fetch('http://127.0.0.1:5599/', {method:'POST', mode:'no-cors',
          body: canvas.toDataURL('image/png')})

The receiver decodes and writes the file, then exits after <count> posts.
For the game canvas, composite the DOM background first (see CLAUDE.md
"Known issues" -> screenshot notes).
"""
import argparse
import base64
from http.server import BaseHTTPRequestHandler, HTTPServer

ap = argparse.ArgumentParser()
ap.add_argument('outfile')
ap.add_argument('--port', type=int, default=5599)
ap.add_argument('--count', type=int, default=1,
                help='exit after this many posts; >1 appends -2, -3... to the name')
args = ap.parse_args()


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n).decode()
        b64 = data.split('base64,', 1)[1] if 'base64,' in data else data
        self.server.received += 1
        out = args.outfile
        if self.server.received > 1:
            root, dot, ext = out.rpartition('.')
            out = f'{root}-{self.server.received}{dot}{ext}' if dot else f'{out}-{self.server.received}'
        with open(out, 'wb') as f:
            f.write(base64.b64decode(b64))
        print('saved', out)
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def log_message(self, *a):
        pass


srv = HTTPServer(('127.0.0.1', args.port), H)
srv.received = 0
print(f'listening on 127.0.0.1:{args.port} for {args.count} post(s)...')
while srv.received < args.count:
    srv.handle_request()
