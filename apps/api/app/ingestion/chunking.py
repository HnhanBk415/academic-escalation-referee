import re
from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    heading: str | None
    content: str
    page_number: int | None = None


def _sections(text: str) -> list[tuple[str | None, str]]:
    sections: list[tuple[str | None, str]] = []
    heading: str | None = None
    body: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if re.match(r"^#{1,6}\s+", stripped):
            if body:
                sections.append((heading, "\n".join(body).strip()))
                body = []
            heading = re.sub(r"^#{1,6}\s+", "", stripped)
        elif stripped:
            body.append(stripped)
        elif body and body[-1] != "":
            body.append("")
    if body:
        sections.append((heading, "\n".join(body).strip()))
    return [(item_heading, body_text) for item_heading, body_text in sections if body_text]


def chunk_text(
    text: str,
    *,
    max_words: int = 600,
    overlap_words: int = 90,
) -> list[TextChunk]:
    """Chunk by headings/paragraphs, splitting only when a section is too large."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return []
    chunks: list[TextChunk] = []
    for heading, body in _sections(normalized) or [(None, normalized)]:
        words = body.split()
        if len(words) <= max_words:
            chunks.append(TextChunk(heading=heading, content=body))
            continue
        start = 0
        while start < len(words):
            end = min(start + max_words, len(words))
            chunks.append(TextChunk(heading=heading, content=" ".join(words[start:end])))
            if end == len(words):
                break
            start = max(end - overlap_words, start + 1)
    return chunks
