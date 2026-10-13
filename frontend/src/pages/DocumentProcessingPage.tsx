import { useEffect, useMemo, useState } from "react";
import { api, apiBlob, postJson } from "../api/client";
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
      <span key={`old-${idx}`} className="diff-removed">{word} </span>
    )
  ));

  const newElements = newWords.map((word, idx) => (
    commonNew.has(idx) ? (
      <span key={`new-${idx}`}>{word} </span>
    ) : (
      <span key={`new-${idx}`} className="diff-added">{word} </span>
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
    [processing],
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
      setError("Nhập tiêu đề và phiên bản quy định.");
      return;
    }
    if (!file && !text.trim()) {
      setError("Tải file hoặc nhập nội dung quy định.");
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
          confidence_threshold: 0.80,
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

  const retryFailed = async () => {
    if (processing?.id) {
      try {
        await api(`/api/v1/documents/processing/${processing.id}/discard`, { method: "POST" });
      } catch {
        // ignore error during cleanup
      }
    }
    setProcessing(null);
    setStep(1);
    setFile(null);
    setText("");
    setError("");
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
        },
      );
      setProcessing(result);
      const next = result.review_items.find((item) => item.status === "PENDING") ?? null;
      if (next) {
        chooseReview(next);
      } else {
        setSelected(null);
        setNotice("Đã xác nhận toàn bộ nội dung cần rà soát. Bạn có thể chuyển sang bước kiểm tra xung đột.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu xác nhận.");
    } finally {
      setBusy(false);
    }
  };

  const discardDraft = async () => {
    if (!processing) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/documents/processing/${processing.id}/discard`, { method: "POST" });
      // Reset state về bước 1 với form trống
      setProcessing(null);
      setStep(1);
      setTitle("Quy định học phần");
      setVersion("1.0");
      setText("");
      setFile(null);
      setSelected(null);
      setDraft("");
      setCropUrl(null);
      setConflicts([]);
      setResolutions({});
      setNotice("Đã hủy bản nháp thành công.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể hủy bản nháp.");
    } finally {
      setBusy(false);
      setModal(null);
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
      message: "Bản nháp sẽ chuyển sang trạng thái đã hủy (DISCARDED) và không được lưu vào hệ thống.",
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
        },
      );
      setProcessing(result);
      setNotice(
        "Đã lưu cập nhật quy định thành công! Hệ thống đã tự động lập chỉ mục và điều chỉnh các lớp quy định tương ứng.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xuất bản quy định.");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setProcessing(null);
    setStep(1);
    setTitle("Quy định học phần");
    setVersion("1.0");
    setText("");
    setFile(null);
    setSelected(null);
    setDraft("");
    setCropUrl(null);
    setConflicts([]);
    setResolutions({});
    setError("");
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
  const allConflictsResolved = conflicts.length === 0 || conflicts.every((c) => resolutions[c.new_chunk_index] !== undefined);

  return (
    <div className="doc-workspace">
      {/* Intro Header */}
      <section className="doc-intro">
        <div>
          <p className="eyebrow">GEMINI VISION · QUẢN LÝ TIẾP NHẬN QUY ĐỊNH</p>
          <h1>Tiếp nhận quy định</h1>
          <p>
            Trích xuất tài liệu quy định học phần, rà soát nhận diện OCR tiếng Việt và phát hiện xung đột
            trước khi xuất bản cập nhật.
          </p>
        </div>
        <div className="offline-pill">
          <span /> Gemini Vision
        </div>
      </section>

      {/* Stepper Bar */}
      <div className="doc-stepper">
        <div className={`doc-step-item ${step === 1 ? "active" : step > 1 || isCompleted ? "completed" : ""}`}>
          <div className="doc-step-num">1</div>
          <span>1. Nguồn tài liệu</span>
        </div>
        <div className="doc-step-arrow">→</div>
        <div className={`doc-step-item ${step === 2 ? "active" : step > 2 || isCompleted ? "completed" : ""}`}>
          <div className="doc-step-num">2</div>
          <span>2. Rà soát nhận dạng</span>
        </div>
        <div className="doc-step-arrow">→</div>
        <div className={`doc-step-item ${step === 3 ? "active" : isCompleted ? "completed" : ""}`}>
          <div className="doc-step-num">3</div>
          <span>3. Kiểm tra xung đột & Lưu</span>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      {/* FAILED State Retry Banner */}
      {isFailed && (
        <section className="doc-panel" style={{ marginBottom: 20, borderColor: "var(--red)" }}>
          <div className="doc-panel-heading">
            <div>
              <h2 style={{ color: "var(--red)" }}>Xử lý tài liệu thất bại</h2>
              <p>{processing.error_message || "Đã xảy ra lỗi trong quá trình trích xuất tài liệu."}</p>
            </div>
          </div>
          <button className="primary-button" onClick={retryFailed}>
            Thử lại (Quay về bước 1)
          </button>
        </section>
      )}

      {/* COMPLETED State Result Summary Screen */}
      {isCompleted && (
        <section className="doc-panel finalize-summary-panel">
          <div className="doc-panel-heading">
            <div>
              <h2>Xuất bản quy định hoàn tất</h2>
              <p>Phiên bản {processing.document.version} — {processing.document.title} đã có hiệu lực.</p>
            </div>
            <strong style={{ background: "#ecfdf5", color: "#047857" }}>Đã xuất bản</strong>
          </div>

          <div className="summary-stat-grid">
            <div className="summary-stat-box">
              <strong>{processing.finalize_summary?.added_count ?? 0}</strong>
              <span>Đoạn thêm mới</span>
            </div>
            <div className="summary-stat-box">
              <strong>{processing.finalize_summary?.replaced_count ?? 0}</strong>
              <span>Đoạn thay thế</span>
            </div>
            <div className="summary-stat-box">
              <strong>{processing.finalize_summary?.skipped_count ?? 0}</strong>
              <span>Đoạn bỏ qua (giữ cũ)</span>
            </div>
          </div>

          <div className="clean-preview" style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 13, marginBottom: 8, color: "var(--navy)" }}>Văn bản đã lập chỉ mục</h3>
            <pre>{processing.clean_text ?? processing.raw_text}</pre>
          </div>

          <div className="export-actions" style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="secondary-button" onClick={() => void download("txt")}>
                Tải TXT
              </button>
              <button className="secondary-button" onClick={() => void download("json")}>
                Tải JSON
              </button>
            </div>
            <button className="primary-button" onClick={resetAll}>
              Tải tài liệu khác →
            </button>
          </div>
        </section>
      )}

      {/* STEP 1: Upload Form */}
      {step === 1 && !isCompleted && !isFailed && (
        <section className="doc-panel upload-panel">
          <div className="doc-panel-heading">
            <div>
              <h2>Nguồn quy định</h2>
              <p>PDF, Word (.docx), PNG, JPG/JPEG hoặc nhập trực tiếp. Ảnh/PDF quét sẽ được gửi tới Gemini Vision.</p>
            </div>
            <strong>Ngưỡng: 80%</strong>
          </div>
          <div className="doc-fields">
            <label>
              Học phần
              <input value={courseId} disabled />
            </label>
            <label>
              Tiêu đề
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Phiên bản
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="VD: 2026.2" />
            </label>
          </div>
          <label className="upload-drop">
            <input
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <strong>{file ? file.name : "Chọn file quy định"}</strong>
            <small>PDF, DOCX, PNG, JPG/JPEG · tối đa theo cấu hình Local</small>
          </label>
          <div className="or-divider">
            <span>hoặc</span>
          </div>
          <label>
            Nhập văn bản trực tiếp
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) setFile(null);
              }}
              rows={9}
              placeholder="Dán nội dung quy định tại đây..."
            />
          </label>
          <button className="primary-button" disabled={busy} onClick={start}>
            {busy ? "Đang xử lý Local…" : "Trích xuất & rà soát →"}
          </button>
        </section>
      )}

      {/* STEP 2: Review OCR items */}
      {step === 2 && processing && !isCompleted && !isFailed && (
        <>
          <div className="doc-nav-bar">
            <button className="secondary-button" onClick={handleBackToStep1} disabled={busy}>
              ← Quay lại
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="danger-button" onClick={handleDiscardClick} disabled={busy}>
                Hủy, không lưu
              </button>
              <button
                className="primary-button"
                onClick={goToStep3}
                disabled={busy || pending.length > 0}
              >
                Tiếp tục: Kiểm tra xung đột →
              </button>
            </div>
          </div>

          <section className="doc-status-row">
            <div>
              <span className="status-kicker">Phiên bản {processing.document.version}</span>
              <h2>{processing.document.title}</h2>
              <p>
                {processing.extraction_method} · nguồn:{" "}
                {processing.original_filename ?? "Văn bản nhập trực tiếp"}
              </p>
            </div>
            <div className={`processing-state ${processing.status.toLowerCase()}`}>
              {pending.length === 0 ? "Đã rà soát xong" : `${pending.length} cần rà soát`}
            </div>
          </section>

          <div className="doc-review-layout">
            <section className="doc-panel review-list">
              <div className="doc-panel-heading">
                <div>
                  <h2>Cần rà soát</h2>
                  <p>Độ tin cậy thấp hơn ngưỡng 0.80.</p>
                </div>
                <strong>{pending.length}</strong>
              </div>
              {pending.length ? (
                pending.map((item) => (
                  <button
                    key={item.id}
                    className={`review-row ${selected?.id === item.id ? "selected" : ""}`}
                    onClick={() => chooseReview(item)}
                  >
                    <span>Cần rà soát</span>
                    <strong>{item.predicted_text}</strong>
                    <small>
                      {Math.round(item.confidence * 100)}% · trang {item.page_number ?? "–"}
                    </small>
                  </button>
                ))
              ) : (
                <div className="review-empty">
                  Không còn vùng nào cần xác nhận. Bấm "Tiếp tục: Kiểm tra xung đột →" ở trên.
                </div>
              )}
            </section>

            <section className="doc-panel review-detail">
              {selected ? (
                <>
                  <div className="doc-panel-heading">
                    <div>
                      <h2>Xác nhận nhận diện</h2>
                      <p>Giữ nguyên dự đoán hoặc sửa trực tiếp.</p>
                    </div>
                    <strong>{Math.round(selected.confidence * 100)}%</strong>
                  </div>
                  {cropUrl && <img className="ocr-crop" src={cropUrl} alt="Vùng ảnh cần rà soát" />}
                  <div className="ocr-context">
                    <span>{selected.context_before || "…"}</span>
                    <mark>{selected.predicted_text}</mark>
                    <span>{selected.context_after || "…"}</span>
                  </div>
                  <label>
                    Nội dung xác nhận
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
                  </label>
                  <div className="review-actions">
                    <button className="secondary-button" disabled={busy} onClick={() => saveReview(true)}>
                      Giữ dự đoán
                    </button>
                    <button className="primary-button" disabled={busy} onClick={() => saveReview(false)}>
                      Lưu chỉnh sửa
                    </button>
                  </div>
                </>
              ) : (
                <div className="review-empty">
                  Chọn một vùng nghi vấn để xem crop và ngữ cảnh ba từ trước/sau.
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* STEP 3: Conflict Detection & Save */}
      {step === 3 && processing && !isCompleted && !isFailed && (
        <>
          <div className="doc-nav-bar">
            <button
              className="secondary-button"
              onClick={() => {
                if (processing.review_items.length > 0) setStep(2);
                else handleBackToStep1();
              }}
              disabled={busy}
            >
              ← Quay lại
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="danger-button" onClick={handleDiscardClick} disabled={busy}>
                Hủy, không lưu
              </button>
              <button
                className="primary-button"
                onClick={finalize}
                disabled={busy || !allConflictsResolved}
              >
                {busy ? "Đang lập chỉ mục…" : "Lưu cập nhật quy định"}
              </button>
            </div>
          </div>

          <section className="doc-status-row">
            <div>
              <span className="status-kicker">Bước 3 · Kiểm tra xung đột quy định</span>
              <h2>{processing.document.title} ({processing.document.version})</h2>
              <p>Hệ thống tự động so khớp các đoạn với quy định cùng chủ đề đang có hiệu lực.</p>
            </div>
            {conflicts.length > 0 && (
              <div className="processing-state" style={{ background: "#fff7ed", color: "#c2410c" }}>
                Đã xử lý {Object.keys(resolutions).length}/{conflicts.length} xung đột
              </div>
            )}
          </section>

          {loadingConflicts ? (
            <section className="doc-panel" style={{ padding: 32, textAlign: "center" }}>
              <p>Đang phân tích và so khớp xung đột quy định...</p>
            </section>
          ) : conflicts.length === 0 ? (
            <section className="doc-panel" style={{ borderLeft: "4px solid var(--green)" }}>
              <div className="doc-panel-heading">
                <div>
                  <h2 style={{ color: "var(--green)" }}>Không phát hiện xung đột với quy định đang hiệu lực</h2>
                  <p>Tài liệu mới sẽ được thêm vào hệ thống dưới dạng các lớp cập nhật mới.</p>
                </div>
              </div>
              <div className="clean-preview" style={{ marginTop: 12 }}>
                <pre>{processing.clean_text ?? processing.raw_text}</pre>
              </div>
            </section>
          ) : (
            <div className="conflict-section">
              <div style={{ marginBottom: 14, fontSize: 13, color: "var(--slate-700)" }}>
                Phát hiện <strong>{conflicts.length}</strong> đoạn có nội dung cùng chủ đề với quy định hiện hành.
                Vui lòng chọn phương án xử lý cho từng đoạn:
              </div>

              {conflicts.map((conflict) => {
                const existing = conflict.existing[0];
                const diff = existing ? computeWordDiff(existing.content, conflict.new_content) : null;
                const chosen = resolutions[conflict.new_chunk_index] || "REPLACE";

                return (
                  <div key={conflict.new_chunk_index} className="conflict-card">
                    <div className="conflict-header">
                      <strong>Xung đột #{conflict.new_chunk_index + 1} · Chủ đề: {conflict.policy_topic}</strong>
                      <span style={{ color: "var(--muted)" }}>Đoạn {conflict.new_chunk_index + 1}</span>
                    </div>

                    <div className="conflict-grid">
                      {/* Left side: Đang hiệu lực */}
                      <div className="conflict-col">
                        <div className="conflict-col-title">
                          <span>Đang hiệu lực</span>
                          <span style={{ color: "var(--muted)" }}>{existing?.published_at ? new Date(existing.published_at).toLocaleDateString("vi-VN") : "Hiện hành"}</span>
                        </div>
                        <div className="conflict-col-meta">
                          <span>Tài liệu: <strong>{existing?.source_document_title || "Quy định cũ"}</strong></span>
                        </div>
                        <div className="conflict-content-box">
                          {diff ? diff.oldElements : existing?.content}
                        </div>
                      </div>

                      {/* Right side: Bản mới tải lên */}
                      <div className="conflict-col">
                        <div className="conflict-col-title">
                          <span style={{ color: "var(--crimson)" }}>Bản mới tải lên</span>
                          <span>Phiên bản {processing.document.version}</span>
                        </div>
                        <div className="conflict-col-meta">
                          <span>Tài liệu: <strong>{processing.document.title}</strong></span>
                        </div>
                        <div className="conflict-content-box">
                          {diff ? diff.newElements : conflict.new_content}
                        </div>
                      </div>
                    </div>

                    <div className="conflict-footer">
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--slate-700)" }}>
                        Phương án áp dụng:
                      </span>
                      <div className="segmented-control">
                        <button
                          type="button"
                          className={`segmented-btn ${chosen === "REPLACE" ? "active" : ""}`}
                          onClick={() => setConflictResolution(conflict.new_chunk_index, "REPLACE")}
                        >
                          Dùng bản mới (thay thế)
                        </button>
                        <button
                          type="button"
                          className={`segmented-btn ${chosen === "KEEP_OLD" ? "active" : ""}`}
                          onClick={() => setConflictResolution(conflict.new_chunk_index, "KEEP_OLD")}
                        >
                          Giữ bản cũ
                        </button>
                        <button
                          type="button"
                          className={`segmented-btn ${chosen === "KEEP_BOTH" ? "active" : ""}`}
                          onClick={() => setConflictResolution(conflict.new_chunk_index, "KEEP_BOTH")}
                        >
                          Giữ cả hai
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {modal && modal.open && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <h3>{modal.title}</h3>
            <p>{modal.message}</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Không, tiếp tục
              </button>
              <button
                className="danger-button"
                onClick={() => void modal.onConfirm()}
                disabled={busy}
              >
                {modal.confirmText || "Đồng ý"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
