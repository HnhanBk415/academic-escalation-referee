import React, { useEffect, useMemo, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Download,
  Check,
  RefreshCw,
} from "lucide-react";
import { api, apiBlob, postJson } from "../api/client";
import { Badge, Button, Card, Modal, PageHeader } from "../components/ui";
import { policyTopicLabel } from "../utils/labels";
import type {
  ConflictItem,
  ConflictResolutionAction,
  ProcessingResponse,
  ReviewItem,
} from "../types";

interface Props {
  courseId: string;
}

interface DiffResult {
  oldElements: React.ReactNode[];
  newElements: React.ReactNode[];
}

function computeWordDiff(oldStr: string, newStr: string): DiffResult {
  const oldWords = oldStr.trim().split(/\s+/).filter(Boolean);
  const newWords = newStr.trim().split(/\s+/).filter(Boolean);

  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldWords[i].toLowerCase() === newWords[j].toLowerCase()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const commonOld = new Set<number>();
  const commonNew = new Set<number>();
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldWords[i - 1].toLowerCase() === newWords[j - 1].toLowerCase()) {
      commonOld.add(i - 1);
      commonNew.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const oldElements = oldWords.map((word, idx) => (
    commonOld.has(idx) ? (
      <span key={`old-${idx}`}>{word} </span>
    ) : (
      <span key={`old-${idx}`} className="bg-rose-100 text-rose-800 line-through px-0.5 rounded">
        {word}{" "}
      </span>
    )
  ));

  const newElements = newWords.map((word, idx) => (
    commonNew.has(idx) ? (
      <span key={`new-${idx}`}>{word} </span>
    ) : (
      <span key={`new-${idx}`} className="bg-emerald-100 text-emerald-800 font-medium px-0.5 rounded">
        {word}{" "}
      </span>
    )
  ));

  return { oldElements, newElements };
}

export function DocumentProcessingPage({ courseId }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("Quy định học phần");
  const [version, setVersion] = useState("1.0");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<ProcessingResponse | null>(null);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [draft, setDraft] = useState("");
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Conflict state
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [resolutions, setResolutions] = useState<Record<number, ConflictResolutionAction>>({});
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  // Confirmation Modal state
  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const pending = useMemo(
    () => processing?.review_items.filter((item) => item.status === "PENDING") ?? [],
    [processing]
  );

  useEffect(() => {
    let revoke: string | null = null;
    async function loadCrop() {
      if (!selected?.crop_url) {
        setCropUrl(null);
        return;
      }
      try {
        const blob = await apiBlob(selected.crop_url);
        revoke = URL.createObjectURL(blob);
        setCropUrl(revoke);
      } catch {
        setCropUrl(null);
      }
    }
    void loadCrop();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [selected]);

  const chooseReview = (item: ReviewItem) => {
    setSelected(item);
    setDraft(item.confirmed_text ?? item.predicted_text);
  };

  const loadConflicts = async (procId: string) => {
    setLoadingConflicts(true);
    setError("");
    try {
      const data = await api<ConflictItem[]>(`/api/v1/documents/processing/${procId}/conflicts`);
      setConflicts(data);
      setResolutions({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kiểm tra xung đột quy định.");
    } finally {
      setLoadingConflicts(false);
    }
  };

  const start = async () => {
    setError("");
    setNotice("");
    if (!title.trim() || !version.trim()) {
      setError("Vui lòng nhập tiêu đề và phiên bản quy định.");
      return;
    }
    if (!file && !text.trim()) {
      setError("Vui lòng tải tệp hoặc nhập nội dung văn bản quy định.");
      return;
    }
    setBusy(true);
    try {
      let result: ProcessingResponse;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("course_id", courseId);
        form.append("title", title);
        form.append("version", version);
        form.append("confidence_threshold", "0.80");
        result = await api<ProcessingResponse>("/api/v1/documents/processing/upload", {
          method: "POST",
          body: form,
        });
      } else {
        result = await postJson<ProcessingResponse>("/api/v1/documents/processing/text", {
          course_id: courseId,
          title,
          version,
          text_content: text,
          confidence_threshold: 0.8,
        });
      }
      setProcessing(result);

      if (result.status === "FAILED") {
        setError(result.error_message || "Xử lý tài liệu thất bại.");
        return;
      }

      const pendingItems = result.review_items.filter((item) => item.status === "PENDING");
      if (pendingItems.length > 0) {
        setStep(2);
        chooseReview(pendingItems[0]);
        setNotice(`Đã trích xuất. Cần rà soát ${pendingItems.length} vùng có độ tin cậy dưới 80%.`);
      } else {
        setStep(3);
        setNotice("Đã trích xuất xong. Tiến hành kiểm tra xung đột quy định.");
        void loadConflicts(result.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xử lý tài liệu.");
    } finally {
      setBusy(false);
    }
  };

  const resetToStart = () => {
    setStep(1);
    setProcessing(null);
    setConflicts([]);
    setResolutions({});
    setSelected(null);
    setDraft("");
    setCropUrl(null);
    setFile(null);
    setText("");
    setTitle("Quy định học phần");
    setVersion("1.0");
    setError("");
  };

  const retryFailed = async () => {
    const procId = processing?.id;
    if (procId) {
      try {
        await api(`/api/v1/documents/processing/${procId}/discard`, { method: "POST" });
      } catch {
        // ignore
      }
    }
    resetToStart();
    setNotice("");
  };

  const saveReview = async (keepPrediction = false) => {
    if (!processing || !selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<ProcessingResponse>(
        `/api/v1/documents/processing/${processing.id}/review-items/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            confirmed_text: draft,
            keep_prediction: keepPrediction,
          }),
        }
      );
      setProcessing(result);
      const next = result.review_items.find((item) => item.status === "PENDING") ?? null;
      if (next) {
        chooseReview(next);
      } else {
        setSelected(null);
        setNotice("Đã hoàn tất rà soát. Bạn có thể chuyển sang bước kiểm tra xung đột.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu xác nhận.");
    } finally {
      setBusy(false);
    }
  };

  const discardDraft = async () => {
    const procId = processing?.id;
    setBusy(true);
    setError("");
    setModal(null);
    try {
      if (procId) {
        await api(`/api/v1/documents/processing/${procId}/discard`, { method: "POST" });
      }
    } catch (e) {
      console.warn("Discard draft error:", e);
    } finally {
      resetToStart();
      setNotice("Đã hủy bản nháp");
      setBusy(false);
    }
  };

  const handleBackToStep1 = () => {
    setModal({
      open: true,
      title: "Hủy bản nháp và quay lại?",
      message: "Quay lại bước 1 sẽ hủy bản nháp hiện tại trên hệ thống. Bạn có chắc chắn muốn quay lại?",
      confirmText: "Hủy bản nháp & Quay lại",
      onConfirm: discardDraft,
    });
  };

  const handleDiscardClick = () => {
    setModal({
      open: true,
      title: "Hủy, không lưu quy định?",
      message: "Bản nháp sẽ chuyển sang trạng thái đã hủy và không được lưu vào hệ thống.",
      confirmText: "Xác nhận hủy",
      onConfirm: discardDraft,
    });
  };

  const goToStep3 = () => {
    if (!processing) return;
    setStep(3);
    void loadConflicts(processing.id);
  };

  const setConflictResolution = (chunkIndex: number, action: ConflictResolutionAction) => {
    setResolutions((prev) => ({
      ...prev,
      [chunkIndex]: action,
    }));
  };

  const finalize = async () => {
    if (!processing) return;
    setBusy(true);
    setError("");
    try {
      const payloadResolutions = Object.entries(resolutions).map(([idx, action]) => ({
        new_chunk_index: Number(idx),
        action,
      }));
      const result = await api<ProcessingResponse>(
        `/api/v1/documents/processing/${processing.id}/finalize`,
        {
          method: "POST",
          body: JSON.stringify({
            resolutions: payloadResolutions.length > 0 ? payloadResolutions : undefined,
          }),
        }
      );
      setProcessing(result);
      setNotice("Đã lưu cập nhật quy định thành công! Hệ thống đã tự động lập chỉ mục.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xuất bản quy định.");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    resetToStart();
    setNotice("");
  };

  const download = async (format: "txt" | "json") => {
    if (!processing) return;
    setError("");
    try {
      const blob = await apiBlob(`/api/v1/documents/processing/${processing.id}/export/${format}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${processing.document.title}-clean.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải tệp xuất.");
    }
  };

  const isCompleted = processing?.status === "COMPLETED";
  const isFailed = processing?.status === "FAILED";
  const allConflictsResolved =
    conflicts.length === 0 || conflicts.every((c) => resolutions[c.new_chunk_index] !== undefined);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="Tiếp nhận quy định"
        description="Trích xuất tài liệu học phần, rà soát OCR tiếng Việt và xử lý xung đột quy chế"
      />

      {/* Stepper Material ngang */}
      <div data-tour="docs-stepper" className="flex items-center justify-between bg-[var(--surface-container-low)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--outline)]/20">
        {/* Step 1 */}
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              isCompleted || step > 1
                ? "bg-[#E8F5E9] text-[#146C2E]"
                : step === 1
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
            }`}
          >
            {isCompleted || step > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
          </div>
          <span
            className={`text-xs font-medium ${
              step === 1 || isCompleted ? "text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]"
            }`}
          >
            Nguồn tài liệu
          </span>
        </div>

        <div className="flex-1 h-0.5 bg-[var(--outline)]/20 mx-4" />

        {/* Step 2 */}
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              isCompleted || step > 2
                ? "bg-[#E8F5E9] text-[#146C2E]"
                : step === 2
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
            }`}
          >
            {isCompleted || step > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
          </div>
          <span
            className={`text-xs font-medium ${
              step === 2 || isCompleted ? "text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]"
            }`}
          >
            Rà soát nhận diện
          </span>
        </div>

        <div className="flex-1 h-0.5 bg-[var(--outline)]/20 mx-4" />

        {/* Step 3 */}
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              isCompleted
                ? "bg-[#E8F5E9] text-[#146C2E]"
                : step === 3
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
            }`}
          >
            {isCompleted ? <Check className="w-3.5 h-3.5" /> : "3"}
          </div>
          <span
            className={`text-xs font-medium ${
              step === 3 || isCompleted ? "text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]"
            }`}
          >
            Kiểm tra xung đột & Lưu
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-[var(--radius-md)] bg-[#E8F5E9] border border-[#C8E6C9] text-[#146C2E] text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* FAILED State */}
      {isFailed && (
        <Card className="p-6 border-[var(--error)]/30 bg-[var(--error)]/5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[var(--error)]">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-base font-semibold">Xử lý tài liệu thất bại</h2>
            </div>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {processing.error_message || "Đã xảy ra lỗi trong quá trình trích xuất tài liệu."}
            </p>
            <div className="pt-2">
              <Button variant="filled" onClick={retryFailed}>
                Thử lại (Quay về bước 1)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* COMPLETED State */}
      {isCompleted && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--outline)]/20">
            <div>
              <h2 className="text-base font-semibold text-[var(--on-surface)]">
                Xuất bản quy định hoàn tất
              </h2>
              <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                Phiên bản {processing.document.version} — {processing.document.title} đã có hiệu lực.
              </p>
            </div>
            <Badge tone="answer">Đã xuất bản</Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--surface-container-low)] rounded-[var(--radius-md)] text-center">
              <div className="text-xl font-semibold text-[var(--on-surface)]">
                {processing.finalize_summary?.added_count ?? 0}
              </div>
              <span className="text-xs text-[var(--on-surface-variant)] mt-1 block">
                Đoạn thêm mới
              </span>
            </div>
            <div className="p-4 bg-[var(--surface-container-low)] rounded-[var(--radius-md)] text-center">
              <div className="text-xl font-semibold text-[var(--on-surface)]">
                {processing.finalize_summary?.replaced_count ?? 0}
              </div>
              <span className="text-xs text-[var(--on-surface-variant)] mt-1 block">
                Đoạn thay thế
              </span>
            </div>
            <div className="p-4 bg-[var(--surface-container-low)] rounded-[var(--radius-md)] text-center">
              <div className="text-xl font-semibold text-[var(--on-surface)]">
                {processing.finalize_summary?.skipped_count ?? 0}
              </div>
              <span className="text-xs text-[var(--on-surface-variant)] mt-1 block">
                Đoạn giữ nguyên
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-[var(--on-surface)] mb-2">
              Văn bản đã lập chỉ mục
            </h3>
            <pre className="p-4 bg-[var(--surface-container-lowest)] rounded-[var(--radius-md)] border border-[var(--outline)]/20 text-xs font-mono text-[var(--on-surface)] max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {processing.clean_text ?? processing.raw_text}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Button variant="tonal" size="sm" onClick={() => void download("txt")} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Tải TXT
              </Button>
              <Button variant="tonal" size="sm" onClick={() => void download("json")} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Tải JSON
              </Button>
            </div>
            <Button variant="filled" onClick={resetAll} className="gap-1.5">
              <span>Tải tài liệu khác</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 1: Upload Form */}
      {step === 1 && !isCompleted && !isFailed && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--outline)]/20">
            <div>
              <h2 className="text-sm font-semibold text-[var(--on-surface)]">Nguồn quy định</h2>
              <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                Hỗ trợ PDF, DOCX, ảnh chụp PNG/JPG hoặc dán văn bản trực tiếp.
              </p>
            </div>
            <span className="text-xs text-[var(--on-surface-variant)] bg-[var(--surface-container-high)] px-2.5 py-1 rounded-full">
              Ngưỡng OCR: 80%
            </span>
          </div>

          {/* Fields */}
          <div data-tour="docs-meta" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--on-surface)] mb-1">
                Mã học phần
              </label>
              <input
                type="text"
                value={courseId}
                disabled
                className="w-full rounded-[var(--radius-md)] border border-[var(--outline)]/30 bg-[var(--surface-container-low)] px-3 py-2 text-sm text-[var(--on-surface)] cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--on-surface)] mb-1">
                Tiêu đề quy định <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--outline)]/40 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--on-surface)] mb-1">
                Phiên bản <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="VD: 2026.2"
                className="w-full rounded-[var(--radius-md)] border border-[var(--outline)]/40 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          </div>

          {/* Dropzone with outlined dashed bo --radius-lg */}
          <label data-tour="docs-upload" className="flex flex-col items-center justify-center p-8 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--outline)]/40 hover:border-[var(--primary)]/60 bg-[var(--surface-container-lowest)]/50 hover:bg-[var(--surface-container-low)] cursor-pointer transition-colors text-center group">
            <input
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--on-surface-variant)] group-hover:text-[var(--primary)] mb-3 transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[var(--on-surface)]">
              {file ? file.name : "Tải lên tệp văn bản quy định"}
            </p>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              PDF, DOCX, PNG, JPG/JPEG (kéo thả hoặc nhấn để duyệt tệp)
            </p>
          </label>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--outline)]/20" />
            <span className="text-xs text-[var(--on-surface-variant)]">hoặc dán văn bản</span>
            <div className="flex-1 h-px bg-[var(--outline)]/20" />
          </div>

          <div data-tour="docs-text">
            <textarea
              data-tour="docs-try"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setFile(null);
              }}
              rows={6}
              placeholder="Dán toàn văn nội dung quy định học phần tại đây..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--outline)]/40 bg-[var(--surface)] p-3 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)]/50 focus:border-[var(--primary)] focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              data-tour="docs-submit"
              variant="filled"
              disabled={busy}
              onClick={start}
              icon={
                busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )
              }
              iconPosition={busy ? "left" : "right"}
            >
              {busy ? "Đang trích xuất OCR..." : "Trích xuất & Rà soát"}
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Review OCR items */}
      {step === 2 && processing && !isCompleted && !isFailed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="tonal"
              size="sm"
              onClick={handleBackToStep1}
              disabled={busy}
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Quay lại
            </Button>
            <div className="flex gap-2">
              <Button
                variant="text"
                size="sm"
                onClick={handleDiscardClick}
                disabled={busy}
                className="text-[var(--error)] hover:bg-[var(--error)]/10"
              >
                Hủy, không lưu
              </Button>
              <Button
                variant="filled"
                size="sm"
                onClick={goToStep3}
                disabled={busy || pending.length > 0}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
              >
                Kiểm tra xung đột
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* List */}
            <Card className="p-4 md:col-span-1 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--outline)]/20">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  Cần rà soát ({pending.length})
                </span>
                <span className="text-xs text-[var(--on-surface-variant)]">Độ tin cậy &lt; 80%</span>
              </div>
              <div className="space-y-2 max-h-[30rem] overflow-y-auto">
                {pending.length ? (
                  pending.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => chooseReview(item)}
                      className={`p-3 rounded-[var(--radius-md)] border text-xs cursor-pointer transition-colors ${
                        selected?.id === item.id
                          ? "border-[var(--primary)] bg-[var(--primary-container)]/30"
                          : "border-[var(--outline)]/30 hover:bg-[var(--surface-container-low)]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] mb-1">
                        <span>Trang {item.page_number ?? "—"}</span>
                        <span className="font-mono">{Math.round(item.confidence * 100)}%</span>
                      </div>
                      <p className="font-medium text-[var(--on-surface)] line-clamp-2">
                        {item.predicted_text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-[var(--on-surface-variant)]">
                    Đã hoàn tất rà soát toàn bộ vùng nghi vấn.
                  </div>
                )}
              </div>
            </Card>

            {/* Detail */}
            <Card className="p-6 md:col-span-2 space-y-4">
              {selected ? (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--outline)]/20">
                    <h3 className="text-sm font-semibold text-[var(--on-surface)]">
                      Xác nhận nội dung nhận diện
                    </h3>
                    <span className="text-xs font-mono text-[var(--on-surface-variant)]">
                      Độ tin cậy: {Math.round(selected.confidence * 100)}%
                    </span>
                  </div>

                  {cropUrl && (
                    <div className="p-2 bg-[var(--surface-container-lowest)] rounded-[var(--radius-md)] border border-[var(--outline)]/20 flex justify-center">
                      <img
                        src={cropUrl}
                        alt="Crop hình ảnh"
                        className="max-h-40 object-contain rounded"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-[var(--surface-container-low)] rounded-[var(--radius-md)] text-xs text-[var(--on-surface)] leading-relaxed">
                    <span className="text-[var(--on-surface-variant)]">{selected.context_before || "…"} </span>
                    <mark className="bg-amber-200 text-amber-900 px-1 py-0.5 rounded font-medium">
                      {selected.predicted_text}
                    </mark>
                    <span className="text-[var(--on-surface-variant)]"> {selected.context_after || "…"}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--on-surface)] mb-1.5">
                      Nội dung xác nhận chuẩn
                    </label>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--outline)]/40 bg-[var(--surface)] p-3 text-sm text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="tonal"
                      size="sm"
                      disabled={busy}
                      onClick={() => saveReview(true)}
                    >
                      Giữ dự đoán
                    </Button>
                    <Button
                      variant="filled"
                      size="sm"
                      disabled={busy}
                      onClick={() => saveReview(false)}
                    >
                      Lưu chỉnh sửa
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--on-surface-variant)]">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Chọn một vùng từ danh sách để xem ảnh cắt và chỉnh sửa</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* STEP 3: Conflict Detection & Save */}
      {step === 3 && processing && !isCompleted && !isFailed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="tonal"
              size="sm"
              onClick={() => {
                if (processing.review_items.length > 0) setStep(2);
                else handleBackToStep1();
              }}
              disabled={busy}
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Quay lại
            </Button>
            <div className="flex gap-2">
              <Button
                id="discard-draft-btn"
                variant="text"
                size="sm"
                onClick={handleDiscardClick}
                disabled={busy}
                className="text-[var(--error)] hover:bg-[var(--error)]/10"
              >
                Hủy, không lưu
              </Button>
              <Button
                id="save-policy-update-btn"
                variant="filled"
                size="sm"
                onClick={finalize}
                disabled={busy || !allConflictsResolved}
                icon={
                  busy ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )
                }
              >
                {busy ? "Đang lưu..." : "Lưu cập nhật quy định"}
              </Button>
            </div>
          </div>

          {loadingConflicts ? (
            <Card className="p-8 text-center text-sm text-[var(--on-surface-variant)]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--primary)]" />
              Đang phân tích và so khớp xung đột quy định...
            </Card>
          ) : conflicts.length === 0 ? (
            <Card className="p-6 border-[#C8E6C9] bg-[#E8F5E9]/30 space-y-3">
              <div className="flex items-center gap-2 text-[#146C2E]">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-sm font-semibold">
                  Không phát hiện xung đột với quy định hiện hành
                </h3>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Tài liệu mới sẽ được thêm vào hệ thống dưới dạng các lớp cập nhật mới.
              </p>
              <pre className="p-4 bg-[var(--surface)] rounded-[var(--radius-md)] border border-[var(--outline)]/20 text-xs font-mono text-[var(--on-surface)] max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed mt-2">
                {processing.clean_text ?? processing.raw_text}
              </pre>
            </Card>
          ) : (
            <div data-tour="docs-conflicts" className="space-y-4">
              <div className="text-xs text-[var(--on-surface-variant)]">
                Phát hiện <strong className="text-[var(--on-surface)]">{conflicts.length}</strong> đoạn có
                nội dung cùng chủ đề với quy định hiện hành. Vui lòng chọn phương án giải quyết cho từng đoạn:
              </div>

              {conflicts.map((conflict) => {
                const hasPolicyUpdate = conflict.existing.some(
                  (e) => e.source_kind === "POLICY_UPDATE"
                );
                const chosen = resolutions[conflict.new_chunk_index];

                return (
                  <Card key={conflict.new_chunk_index} className="p-5 space-y-4">
                    {/* Conflict Title */}
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--outline)]/20">
                      <span className="text-xs font-semibold text-[var(--on-surface)]">
                        Xung đột #{conflict.new_chunk_index + 1} · Chủ đề: {policyTopicLabel(conflict.policy_topic)}
                      </span>
                      <span className="text-xs text-[var(--on-surface-variant)] font-mono">
                        Đoạn {conflict.new_chunk_index + 1}
                      </span>
                    </div>

                    {/* 2-Column Comparison Table / Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left side: Danh sách xếp chồng các nguồn cũ */}
                      <div className="space-y-3">
                        {conflict.existing.map((existingItem, eIdx) => {
                          const diff = computeWordDiff(existingItem.content, conflict.new_content);
                          const isBase = existingItem.source_kind === "BASE_DOCUMENT";
                          const sourceLabel = isBase
                            ? `Quy chế gốc · ${existingItem.source_document_title || "Tài liệu môn học"}`
                            : `Bản cập nhật · ${existingItem.source_document_title || "Bản cập nhật"} · ${
                                existingItem.published_at
                                  ? new Date(existingItem.published_at).toLocaleDateString("vi-VN")
                                  : "Hiện hành"
                              }`;
                          const badgeLabel = isBase ? "Quy chế gốc" : "Đang hiệu lực";

                          return (
                            <div
                              key={existingItem.chunk_id || eIdx}
                              className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] border border-[var(--outline)]/20 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-[var(--on-surface)]">
                                  <span className="font-medium text-[var(--on-surface)]">
                                    {sourceLabel}
                                  </span>
                                  <span className="text-xs text-[var(--on-surface-variant)] font-normal">
                                    {badgeLabel}
                                  </span>
                                </div>
                                <div className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap mt-2">
                                  {diff.oldElements}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right side: Bản mới tải lên */}
                      <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] border border-[var(--outline)]/20 flex flex-col justify-between self-start">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-[var(--primary)]">
                            <span>Bản mới tải lên · {processing.document.title}</span>
                            <span className="text-xs text-[var(--on-surface-variant)] font-normal">
                              Phiên bản {processing.document.version}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap mt-2">
                            {conflict.new_content}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resolution Choice (Segmented button) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--outline)]/15">
                      <span className="text-xs font-medium text-[var(--on-surface)]">
                        Phương án áp dụng:
                      </span>
                      <div className="inline-flex rounded-full bg-[var(--surface-container-high)] p-1 gap-1">
                        <button
                          id={`resolve-replace-${conflict.new_chunk_index}`}
                          type="button"
                          onClick={() => setConflictResolution(conflict.new_chunk_index, "REPLACE")}
                          className={`px-3 py-1 text-xs rounded-full transition-all ${
                            chosen === "REPLACE"
                              ? "bg-[var(--surface)] text-[var(--primary)] font-semibold shadow-xs"
                              : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          Dùng bản mới
                        </button>
                        <button
                          id={`resolve-keep-old-${conflict.new_chunk_index}`}
                          type="button"
                          onClick={() => setConflictResolution(conflict.new_chunk_index, "KEEP_OLD")}
                          className={`px-3 py-1 text-xs rounded-full transition-all ${
                            chosen === "KEEP_OLD"
                              ? "bg-[var(--surface)] text-[var(--primary)] font-semibold shadow-xs"
                              : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          {hasPolicyUpdate ? "Giữ bản cũ" : "Giữ quy chế gốc"}
                        </button>
                        {hasPolicyUpdate && (
                          <button
                            id={`resolve-keep-both-${conflict.new_chunk_index}`}
                            type="button"
                            onClick={() => setConflictResolution(conflict.new_chunk_index, "KEEP_BOTH")}
                            className={`px-3 py-1 text-xs rounded-full transition-all ${
                              chosen === "KEEP_BOTH"
                                ? "bg-[var(--surface)] text-[var(--primary)] font-semibold shadow-xs"
                                : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                            }`}
                          >
                            Giữ cả hai
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {modal && (
        <Modal
          isOpen={modal.open}
          onClose={() => setModal(null)}
          title={modal.title}
          size="sm"
          footer={
            <>
              <Button variant="text" onClick={() => setModal(null)} disabled={busy}>
                Không, tiếp tục
              </Button>
              <Button
                variant="filled"
                className="bg-[var(--error)] hover:bg-[var(--error)]/90 text-white"
                onClick={() => void modal.onConfirm()}
                disabled={busy}
              >
                {modal.confirmText || "Đồng ý"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--on-surface-variant)]">{modal.message}</p>
        </Modal>
      )}
    </div>
  );
}
