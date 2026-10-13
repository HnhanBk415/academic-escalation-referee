from app.core.policy_topics import infer_policy_topic, policy_topics_in_text


def test_rubric_with_teamwork_percentage_infers_grading_rubric():
    # Câu chứa 'rubric', 'chấm điểm', '%' phải ra GRADING_RUBRIC dù có chữ 'nhóm'
    phrase = "hợp tác nhóm chiếm 10%"
    assert infer_policy_topic(phrase) == "GRADING_RUBRIC"
    topics = policy_topics_in_text(phrase)
    assert "GRADING_RUBRIC" in topics
    assert "GROUP_MEMBERSHIP" not in topics


def test_full_rubric_sentence_with_teamwork_infers_grading_rubric():
    text = (
        "Rubric chấm điểm đồ án CO3001: báo cáo chiếm 25%, sản phẩm chiếm 45%, "
        "trình bày chiếm 20%, hợp tác nhóm chiếm 10%."
    )
    assert infer_policy_topic(text) == "GRADING_RUBRIC"
    topics = policy_topics_in_text(text)
    assert "GRADING_RUBRIC" in topics
    assert "GROUP_MEMBERSHIP" not in topics


def test_pure_group_membership_questions_infer_group_membership():
    q1 = "Một nhóm đồ án được có bao nhiêu thành viên?"
    assert infer_policy_topic(q1) == "GROUP_MEMBERSHIP"
    assert "GROUP_MEMBERSHIP" in policy_topics_in_text(q1)

    q2 = "Quy định số lượng sinh viên trong nhóm là gì?"
    assert infer_policy_topic(q2) == "GROUP_MEMBERSHIP"
    assert "GROUP_MEMBERSHIP" in policy_topics_in_text(q2)
