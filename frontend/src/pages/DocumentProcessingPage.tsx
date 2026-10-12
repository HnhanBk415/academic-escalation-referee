import { useEffect, useMemo, useState } from "react";
import { api, apiBlob, postJson } from "../api/client";
import type { ProcessingResponse, ReviewItem } from "../types";

interface Props {
  courseId: string;
}

export function DocumentProcessingPage({ courseId }: Props) {
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
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [selected]);

  const chooseReview = (item: ReviewItem) => {
    setSelected(item);
    setDraft(item.confirmed_text ?? item.predicted_text);
  };

  const start = async () => {
    setError(""); setNotice("");
    if (!title.trim() || !version.trim()) { setError("Nhập tiêu đề và phiên bản quy định."); return; }
    if (!file && !text.trim()) { setError("Tải file hoặc nhập nội dung quy định."); return; }
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
        result = await api<ProcessingResponse>("/api/v1/documents/processing/upload", { method: "POST", body: form });
      } else {
        result = await postJson<ProcessingResponse>("/api/v1/documents/processing/text", {
          course_id: courseId, title, version, text_content: text, confidence_threshold: 0.80,
        });
      }
      setProcessing(result);
      const first = result.review_items.find((item) => item.status === "PENDING") ?? null;
      if (first) chooseReview(first);
      setNotice(first ? "Đã trích xuất Local. Hãy rà soát các vùng được đánh dấu." : "Đã trích xuất Local. Nội dung sẵn sàng xác nhận.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể xử lý tài liệu."); }
    finally { setBusy(false); }
  };

  const saveReview = async (keepPrediction = false) => {
    if (!processing || !selected) return;
    setBusy(true); setError("");
    try {
      const result = await api<ProcessingResponse>(
        `/api/v1/documents/processing/${processing.id}/review-items/${selected.id}`,
        { method: "PATCH", body: JSON.stringify({ confirmed_text: draft, keep_prediction: keepPrediction }) },
      );
      setProcessing(result);
      const next = result.review_items.find((item) => item.status === "PENDING") ?? null;
      if (next) chooseReview(next); else { setSelected(null); setNotice("Đã xác nhận toàn bộ nội dung cần rà soát."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể lưu xác nhận."); }
    finally { setBusy(false); }
  };

  const finalize = async () => {
    if (!processing) return;
    setBusy(true); setError("");
    try {
      const result = await api<ProcessingResponse>(`/api/v1/documents/processing/${processing.id}/finalize`, {
        method: "POST",
      });
      setProcessing(result); setNotice("Đã lưu cập nhật quy định. Khi trả lời: ngoại lệ đã duyệt được ưu tiên trước, sau đó là đoạn cập nhật liên quan mới nhất, rồi đến quy định gốc.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể xác nhận tài liệu."); }
    finally { setBusy(false); }
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
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải tệp xuất."); }
  };

  return <div className="doc-workspace">
    <section className="doc-intro">
      <div><p className="eyebrow">LOCAL / OFFLINE · VIETOCR REVIEW</p><h1>Tiếp nhận quy định</h1><p>File chỉ được lưu và xử lý trên máy chủ Local. VietOCR nhận dạng tiếng Việt; các dòng dưới 80% sẽ cần giảng viên xác nhận.</p></div>
      <div className="offline-pill"><span /> Local only</div>
    </section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {notice && <div className="success-banner" role="status">{notice}</div>}
    {!processing && <section className="doc-panel upload-panel">
      <div className="doc-panel-heading"><div><h2>Nguồn quy định</h2><p>PDF, Word (.docx), PNG, JPG/JPEG hoặc nhập trực tiếp.</p></div><strong>Ngưỡng: 80%</strong></div>
      <div className="doc-fields"><label>Học phần<input value={courseId} disabled /></label><label>Tiêu đề<input value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Phiên bản<input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="VD: 2026.2" /></label></div>
      <label className="upload-drop"><input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><strong>{file ? file.name : "Chọn file quy định"}</strong><small>PDF, DOCX, PNG, JPG/JPEG · tối đa theo cấu hình Local</small></label>
      <div className="or-divider"><span>hoặc</span></div>
      <label>Nhập văn bản trực tiếp<textarea value={text} onChange={(e) => { setText(e.target.value); if (e.target.value) setFile(null); }} rows={9} placeholder="Dán nội dung quy định tại đây..." /></label>
      <button className="primary-button" disabled={busy} onClick={start}>{busy ? "Đang xử lý Local…" : "Trích xuất & rà soát →"}</button>
    </section>}
    {processing && <>
      <section className="doc-status-row"><div><span className="status-kicker">Phiên bản {processing.document.version}</span><h2>{processing.document.title}</h2><p>{processing.extraction_method} · nguồn: {processing.original_filename ?? "Văn bản nhập trực tiếp"}</p></div><div className={`processing-state ${processing.status.toLowerCase()}`}>{processing.status === "COMPLETED" ? "Đã xuất bản" : `${processing.pending_review_count} cần rà soát`}</div></section>
      {processing.status !== "COMPLETED" && <div className="doc-review-layout">
        <section className="doc-panel review-list"><div className="doc-panel-heading"><div><h2>Cần rà soát</h2><p>Độ tin cậy thấp hơn ngưỡng 0.80.</p></div><strong>{pending.length}</strong></div>{pending.length ? pending.map((item) => <button key={item.id} className={`review-row ${selected?.id === item.id ? "selected" : ""}`} onClick={() => chooseReview(item)}><span>Cần rà soát</span><strong>{item.predicted_text}</strong><small>{Math.round(item.confidence * 100)}% · trang {item.page_number ?? "–"}</small></button>) : <div className="review-empty">Không còn vùng nào cần xác nhận.</div>}</section>
        <section className="doc-panel review-detail">{selected ? <><div className="doc-panel-heading"><div><h2>Xác nhận nhận diện</h2><p>Giữ nguyên dự đoán hoặc sửa trực tiếp.</p></div><strong>{Math.round(selected.confidence * 100)}%</strong></div>{cropUrl && <img className="ocr-crop" src={cropUrl} alt="Vùng ảnh cần rà soát" />}<div className="ocr-context"><span>{selected.context_before || "…"}</span><mark>{selected.predicted_text}</mark><span>{selected.context_after || "…"}</span></div><label>Nội dung xác nhận<textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} /></label><div className="review-actions"><button className="secondary-button" disabled={busy} onClick={() => saveReview(true)}>Giữ dự đoán</button><button className="primary-button" disabled={busy} onClick={() => saveReview(false)}>Lưu chỉnh sửa</button></div></> : <div className="review-empty">Chọn một vùng nghi vấn để xem crop và ngữ cảnh ba từ trước/sau.</div>}</section>
      </div>}
      <section className="doc-panel clean-preview"><div className="doc-panel-heading"><div><h2>Văn bản sạch</h2><p>Chỉ có thể lưu sau khi hoàn tất rà soát. Hệ thống tự tạo các lớp cập nhật theo từng đoạn nội dung.</p></div></div><pre>{processing.clean_text ?? processing.raw_text}</pre>{processing.status !== "COMPLETED" ? <button className="primary-button" disabled={busy || processing.pending_review_count > 0} onClick={finalize}>{busy ? "Đang lập chỉ mục…" : "Lưu cập nhật quy định"}</button> : <div className="export-actions"><button className="secondary-button" onClick={() => void download("txt")}>Tải TXT</button><button className="primary-button" onClick={() => void download("json")}>Tải JSON</button></div>}</section>
    </>}
  </div>;
}
