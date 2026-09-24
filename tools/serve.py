#!/usr/bin/env python3
"""Servidor estático do projeto (porta 8751)."""
import gzip, io, os, sys, functools, http.server, socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8751


GZIP = (".html", ".css", ".js", ".json", ".svg")


class H(http.server.SimpleHTTPRequestHandler):
    """Serve igual à produção: comprime texto, para a medição de performance
    local não ficar pessimista (na Vercel tudo sai em gzip/brotli)."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        accepts = "gzip" in self.headers.get("Accept-Encoding", "")
        if not (accepts and os.path.isfile(path) and path.endswith(GZIP)):
            return super().send_head()
        raw = open(path, "rb").read()
        body = gzip.compress(raw, 6)
        self.send_response(200)
        self.send_header("Content-type", self.guess_type(path))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return io.BytesIO(body)

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            sys.stderr.write("404 %s\n" % (args[0] if args else ""))


socketserver.TCPServer.allow_request_reuse = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), functools.partial(H, directory=ROOT)) as httpd:
    httpd.allow_reuse_address = True
    print(f"serving {ROOT} on http://127.0.0.1:{PORT}", flush=True)
    httpd.serve_forever()
