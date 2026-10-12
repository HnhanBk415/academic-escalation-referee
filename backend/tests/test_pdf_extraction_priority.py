from types import SimpleNamespace

import app.ingestion.local_processing as processing


def test_pdf_uses_pymupdf_text_before_gemini_vision(monkeypatch, tmp_path):
    class FakePdf:
        def __iter__(self):
            return iter([SimpleNamespace(get_text=lambda _mode: "Nội dung PDF có sẵn")])

        def close(self):
            pass

    monkeypatch.setitem(__import__("sys").modules, "fitz", SimpleNamespace(open=lambda _path: FakePdf()))
    monkeypatch.setattr(
        processing,
        "_extract_with_gemini_vision",
        lambda *_args: (_ for _ in ()).throw(AssertionError("Gemini must not be called")),
    )

    text, method, tokens, images = processing.extract_document(tmp_path / "policy.pdf", "PDF")

    assert text == "Nội dung PDF có sẵn"
    assert method == "PDF_PYMUPDF_NATIVE"
    assert tokens == []
    assert images == []
