import React, { FormEvent, useState } from "react";
import { postJson } from "../api/client";
import { IconSparkle } from "../components/Icons";
import type { QuestionResponse } from "../types";

interface StudentSubmitViewProps {
  actorId?: string;
  defaultCourseId?: string;
  onSubmitted?: (questionId: string) => void;
}

export function StudentSubmitView({
  actorId = "student-dadn-a1",
  defaultCourseId = "DADN-HK242",
  onSubmitted,
}: StudentSubmitViewProps) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("DADN-HK242");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const courseId = topic.includes("CO3001") ? "CO3001" : "DADN-HK242";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setError("Vui lòng nhập nội dung câu hỏi chi tiết.");
      return;
    }
    setBusy(true);
    setError("");

    const fullQuestion = subject.trim() ? `${subject.trim()}: ${body.trim()}` : body.trim();

    const courseId = topic.includes("CO3001") ? "CO3001" : "DADN-HK242";
    const effectiveActorId = courseId === "CO3001" ? "student-a1" : actorId;

    try {
      const res = await postJson<QuestionResponse>("/api/questions", {
        actor_id: effectiveActorId,
        course_id: courseId,
        text: fullQuestion,
      });

      // Reset form
      setSubject("");
      setBody("");

      // Smooth UX Transition: trigger parent callback to switch to History tab & focus newly created question
      if (onSubmitted && res.question_id) {
        onSubmitted(res.question_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi câu hỏi. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setSubject("");
    setBody("");
    setError("");
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-8 pb-5 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gửi câu hỏi mới</h1>
        <p className="text-sm text-slate-500 mt-1">
          Câu hỏi sẽ được AI Referee xử lý trước, sau đó chuyển tiếp Giảng viên nếu cần
        </p>
      </div>

      {/* Main Form Canvas */}
      <div className="p-8 max-w-3xl space-y-6">
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* AI Referee Note Banner */}
        <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-lg flex items-start gap-3 shadow-xs">
          <div className="text-sky-600 mt-0.5 flex-shrink-0">
            <IconSparkle size={16} />
          </div>
          <p className="text-xs text-sky-900 leading-relaxed font-medium">
            AI Referee sẽ đối chiếu câu hỏi với cơ sở dữ liệu quy chế và phản hồi tự động trong vài phút.
            Trường hợp vượt thẩm quyền sẽ tự động được leo thang lên Giảng viên.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          {/* Question Subject */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
              Tiêu đề câu hỏi
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="VD: Quy định về gia hạn nộp đồ án..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20 transition-all"
            />
          </div>

          {/* Question Topic / Course */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
              Phân nhóm
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20 transition-all cursor-pointer"
            >
              <option value="DADN-HK242">Đồ án Đa ngành (DADN-HK242)</option>
              <option value="CO3001">Đồ án chuyên ngành (CO3001)</option>
              <option value="Luận văn Thạc sĩ">Luận văn Thạc sĩ</option>
              <option value="Luận văn Tốt nghiệp">Luận văn Tốt nghiệp</option>
              <option value="Chương trình Quốc tế">Chương trình Quốc tế</option>
              <option value="Bảo lưu học tập">Bảo lưu học tập</option>
              <option value="Chuyển ngành">Chuyển ngành</option>
              <option value="Học vụ · Gia hạn">Học vụ · Gia hạn</option>
            </select>
          </div>

          {/* Question Body */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
              Nội dung chi tiết <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Mô tả câu hỏi của bạn một cách chi tiết. Bao gồm mã học phần, tình huống cụ thể, và các giấy tờ liên quan nếu có..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20 resize-none transition-all leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Đang xử lý…</span>
                </>
              ) : (
                "Gửi câu hỏi"
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition-all"
            >
              Huỷ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
