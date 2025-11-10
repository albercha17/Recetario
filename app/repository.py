"""Caching layer for accessing recipes from the DOCX file."""
from __future__ import annotations

import os
import threading
from typing import Dict, List

from .parser import DocxRecipeParser


class RecipeRepository:
    """Lazily parses the DOCX file and caches results until it changes."""

    def __init__(self, docx_path: str) -> None:
        self._docx_path = docx_path
        self._cache_mtime: float | None = None
        self._cache_data: List[Dict[str, object]] | None = None
        self._lock = threading.Lock()

    def get_recipes(self) -> List[Dict[str, object]]:
        mtime = self._safe_mtime()
        with self._lock:
            if self._cache_data is None or self._cache_mtime != mtime:
                parser = DocxRecipeParser(self._docx_path)
                self._cache_data = parser.parse()
                self._cache_mtime = mtime
        # Return a shallow copy to avoid accidental external mutation
        return list(self._cache_data or [])

    def _safe_mtime(self) -> float:
        try:
            return os.path.getmtime(self._docx_path)
        except OSError:
            return -1.0


__all__ = ["RecipeRepository"]
