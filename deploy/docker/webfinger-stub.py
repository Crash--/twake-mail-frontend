#!/usr/bin/env python3
"""A stub JMAP server for deploy/docker/smoke-test.sh: answers the WebFinger request
of the app with an SSO on another origin, and writes the requests it gets.

    webfinger-stub.py <port> <file the requests are appended to>
"""
import http.server
import json
import sys
import urllib.parse

ISSUER_REL = "http://openid.net/specs/connect/1.0/issuer"
PORT = int(sys.argv[1])
REQUESTS_FILE = sys.argv[2]


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        with open(REQUESTS_FILE, "a", encoding="utf-8") as requests:
            requests.write(self.path + "\n")
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if urllib.parse.urlparse(self.path).path != "/.well-known/webfinger":
            self.send_response(404)
            self.end_headers()
            return
        body = json.dumps(
            {
                "subject": query.get("resource", [""])[0],
                "links": [{"rel": ISSUER_REL, "href": "https://sso.example.org/realms/x"}],
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/jrd+json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


http.server.HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
