"""Simple HTTP server that exposes the recipes as a small web app."""
from __future__ import annotations

import argparse
import json
import os
from http.server import SimpleHTTPRequestHandler
from socketserver import ThreadingTCPServer
from typing import Tuple
from urllib.parse import urlparse

from app.repository import RecipeRepository

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCX_PATH = os.path.join(ROOT_DIR, "recetario.docx")
STATIC_DIR = os.path.join(ROOT_DIR, "public")


class RecipeRequestHandler(SimpleHTTPRequestHandler):
    """Serve static assets and an API endpoint with the parsed recipes."""

    repository = RecipeRepository(DOCX_PATH)

    def __init__(self, *args, **kwargs) -> None:  # type: ignore[override]
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self) -> None:  # type: ignore[override]
        parsed = urlparse(self.path)
        if parsed.path == "/api/recipes":
            self._handle_recipes_endpoint()
            return

        if parsed.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def _handle_recipes_endpoint(self) -> None:
        try:
            data = {"recipes": self.repository.get_recipes()}
            payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:  # pragma: no cover - defensive
            error = json.dumps({"error": str(exc)}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(error)))
            self.end_headers()
            self.wfile.write(error)

    def log_message(self, format: str, *args) -> None:  # type: ignore[override]
        # Keep default logging behaviour but prefix with handler name for clarity
        super().log_message(format, *args)


class ThreadedHTTPServer(ThreadingTCPServer):
    allow_reuse_address = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Recetario web server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    address: Tuple[str, int] = (args.host, args.port)
    handler = RecipeRequestHandler

    os.makedirs(STATIC_DIR, exist_ok=True)

    with ThreadedHTTPServer(address, handler) as httpd:
        host, port = httpd.server_address
        print(f"Serving recetario on http://{host}:{port} (DOCX: {DOCX_PATH})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")


if __name__ == "__main__":
    main()
