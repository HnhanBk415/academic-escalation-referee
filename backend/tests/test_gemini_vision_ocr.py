from types import SimpleNamespace

from app.core.config import Settings
from app.ingestion.local_processing import _gemini_tokens


def test_gemini_vision_uses_a_separate_key_and_model_from_rag():
    settings = Settings(
        _env_file=None,
        gemini_api_key="rag-key",
        gemini_chat_model="answer-model",
        gemini_vision_api_key="vision-key",
        gemini_vision_model="vision-model",
    )

    assert settings.gemini_api_key == "rag-key"
    assert settings.gemini_vision_api_key == "vision-key"
    assert settings.gemini_chat_model == "answer-model"
    assert settings.gemini_vision_model == "vision-model"


def test_gemini_vision_tokens_keep_review_confidence_and_normalize_boxes():
    image = SimpleNamespace(width=1000, height=500)
    tokens = _gemini_tokens(
        {
            "pages": [{
                "page_number": 1,
                "lines": [
                    {"text": "Hạn nộp là ngày 20.", "confidence": 0.91, "box": [100, 200, 300, 800]},
                    {"text": "Chữ viết tay khó đọc", "box": [400, 100, 500, 600]},
                ],
            }],
        },
        [image],
    )

    assert tokens[0].confidence == 0.91
    assert tokens[0].box == (200, 50, 600, 100)
    assert tokens[1].confidence == 0.5
