"""Utilities to extract recipe data from a DOCX file."""
from __future__ import annotations

import base64
import os
import zipfile
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional
from xml.etree import ElementTree as ET


@dataclass
class RecipeSection:
    """Represents a titled section inside a recipe (e.g. Ingredientes)."""

    title: str
    items: List[str] = field(default_factory=list)


@dataclass
class Recipe:
    """Representation of a recipe extracted from the DOCX file."""

    title: str
    meta: List[Dict[str, str]] = field(default_factory=list)
    sections: List[RecipeSection] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    images: List[Dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, object]:
        return {
            "title": self.title,
            "meta": self.meta,
            "sections": [
                {"title": section.title, "items": section.items}
                for section in self.sections
                if section.items
            ],
            "notes": self.notes,
            "images": self.images,
        }


class DocxRecipeParser:
    """Parse a DOCX recipe book and return structured data."""

    _NS = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
        "rels": "http://schemas.openxmlformats.org/package/2006/relationships",
    }

    _SKIP_TITLES = {"Pestaña 1", "ÍNDICE"}

    def __init__(self, docx_path: str) -> None:
        self.docx_path = docx_path

    def parse(self) -> List[Dict[str, object]]:
        with zipfile.ZipFile(self.docx_path) as docx:
            document_root = ET.fromstring(docx.read("word/document.xml"))
            relationships = self._load_relationships(docx)
            body = document_root.find("w:body", self._NS)
            if body is None:
                return []

            recipes: List[Recipe] = []
            current_recipe: Optional[Recipe] = None
            current_section: Optional[RecipeSection] = None

            for child in body:
                if child.tag == self._qname("w", "p"):
                    style = self._get_paragraph_style(child)
                    text = self._get_paragraph_text(child).strip()
                    image_refs = list(self._iter_images(child))

                    if style == "Title" and text and text not in self._SKIP_TITLES:
                        if current_recipe is not None:
                            recipes.append(current_recipe)
                        current_recipe = Recipe(title=text)
                        current_section = None
                        if image_refs:
                            current_recipe.images.extend(
                                self._materialize_images(docx, relationships, image_refs)
                            )
                        continue

                    if current_recipe is None:
                        # Skip content before the first recipe title
                        continue

                    if style and style.startswith("Heading") and text:
                        current_section = RecipeSection(title=text)
                        current_recipe.sections.append(current_section)
                        if image_refs:
                            current_recipe.images.extend(
                                self._materialize_images(docx, relationships, image_refs)
                            )
                        continue

                    if image_refs:
                        current_recipe.images.extend(
                            self._materialize_images(docx, relationships, image_refs)
                        )

                    if not text:
                        continue

                    if self._looks_like_meta(text) and (current_section is None or not current_section.items):
                        label, value = [part.strip() for part in text.split(":", 1)]
                        current_recipe.meta.append({"label": label, "value": value})
                        continue

                    if current_section is not None:
                        current_section.items.append(text)
                    else:
                        current_recipe.notes.append(text)

                # Ignore tables and other nodes for now

            if current_recipe is not None:
                recipes.append(current_recipe)

            return [recipe.to_dict() for recipe in recipes]

    def _load_relationships(self, docx: zipfile.ZipFile) -> Dict[str, str]:
        rels_path = "word/_rels/document.xml.rels"
        data = docx.read(rels_path)
        root = ET.fromstring(data)
        relationships = {}
        for rel in root.findall("rels:Relationship", self._NS):
            rel_id = rel.attrib.get("Id")
            target = rel.attrib.get("Target")
            if rel_id and target:
                relationships[rel_id] = target
        return relationships

    def _get_paragraph_style(self, paragraph: ET.Element) -> Optional[str]:
        pPr = paragraph.find("w:pPr", self._NS)
        if pPr is None:
            return None
        pStyle = pPr.find("w:pStyle", self._NS)
        if pStyle is None:
            return None
        return pStyle.attrib.get(self._qname("w", "val"))

    def _get_paragraph_text(self, paragraph: ET.Element) -> str:
        parts: List[str] = []
        for node in paragraph.iter():
            if node.tag == self._qname("w", "t") and node.text:
                parts.append(node.text)
            elif node.tag == self._qname("w", "tab"):
                parts.append("\t")
            elif node.tag == self._qname("w", "br"):
                parts.append("\n")
        return "".join(parts)

    def _iter_images(self, paragraph: ET.Element) -> Iterable[str]:
        for blip in paragraph.findall(".//a:blip", self._NS):
            embed = blip.attrib.get(self._qname("r", "embed"))
            if embed:
                yield embed

    def _materialize_images(
        self,
        docx: zipfile.ZipFile,
        relationships: Dict[str, str],
        refs: Iterable[str],
    ) -> List[Dict[str, str]]:
        images: List[Dict[str, str]] = []
        for ref in refs:
            target = relationships.get(ref)
            if not target or not target.startswith("media/"):
                continue
            media_path = f"word/{target}"
            try:
                raw = docx.read(media_path)
            except KeyError:
                continue
            mime = self._guess_mime_type(media_path)
            encoded = base64.b64encode(raw).decode("ascii")
            images.append(
                {
                    "dataUri": f"data:{mime};base64,{encoded}",
                    "contentType": mime,
                    "filename": os.path.basename(media_path),
                }
            )
        return images

    def _guess_mime_type(self, filename: str) -> str:
        _, ext = os.path.splitext(filename.lower())
        if ext in {".jpg", ".jpeg"}:
            return "image/jpeg"
        if ext == ".png":
            return "image/png"
        if ext == ".gif":
            return "image/gif"
        return "application/octet-stream"

    def _looks_like_meta(self, text: str) -> bool:
        if ":" not in text:
            return False
        label = text.split(":", 1)[0].strip().lower()
        return any(label.startswith(keyword) for keyword in ("tiempo", "ración", "raciones", "dificultad"))

    def _qname(self, namespace: str, tag: str) -> str:
        return f"{{{self._NS[namespace]}}}{tag}"


__all__ = ["DocxRecipeParser"]
