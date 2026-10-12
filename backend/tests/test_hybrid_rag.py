from app.rag.service import _reciprocal_rank_fusion


def _item(chunk_id: str, score: float) -> dict:
    return {
        "chunk_id": chunk_id,
        "content_hash": chunk_id,
        "content": chunk_id,
        "document_id": "doc-1",
        "document_title": "Quy chế",
        "heading": None,
        "page_number": None,
        "score": score,
    }


def test_rrf_promotes_result_supported_by_dense_and_keyword_search():
    fused = _reciprocal_rank_fusion(
        [_item("semantic-only", 0.96), _item("supported", 0.81)],
        [_item("exact-only", 0.98), _item("supported", 0.72)],
        rrf_k=60,
    )

    assert fused[0]["chunk_id"] == "supported"
    assert fused[0]["dense_rank"] == 2
    assert fused[0]["keyword_rank"] == 2


def test_rrf_keeps_provenance_scores_for_auditing():
    fused = _reciprocal_rank_fusion(
        [_item("chunk-1", 0.88)],
        [],
        rrf_k=60,
    )

    assert fused[0]["dense_score"] == 0.88
    assert fused[0]["keyword_score"] is None
    assert fused[0]["score"] == 1 / 61
