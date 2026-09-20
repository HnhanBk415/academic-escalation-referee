import type { Citation } from "../types";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <section className="citation-section">
      <div className="section-label">Evidence</div>
      <div className="citation-grid">
        {citations.map((citation) => (
          <details className="citation-card" key={`${citation.label}-${citation.chunk_id}`}>
            <summary>
              <strong>{citation.label}</strong>
              <span>{citation.document_title}</span>
              <small>{citation.page_number ? `p. ${citation.page_number}` : "source"}</small>
            </summary>
            {citation.heading && <div className="citation-heading">{citation.heading}</div>}
            <blockquote>{citation.quote}</blockquote>
          </details>
        ))}
      </div>
    </section>
  );
}
