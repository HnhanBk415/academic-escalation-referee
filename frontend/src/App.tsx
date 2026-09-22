import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { AuditPage }    from "./pages/AuditPage";
import { LecturerPage } from "./pages/LecturerPage";
import { StudentPage }  from "./pages/StudentPage";
import { VerifyPage }   from "./pages/VerifyPage";
import { api }          from "./api/client";
import type { AIHealth } from "./types";

const navItems: Array<{ path: string; label: string; icon: JSX.Element }> = [
  {
    path: "/student",
    label: "Gửi câu hỏi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    path: "/lecturer",
    label: "Hồ sơ của tôi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    path: "/audit",
    label: "Audit Log",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    path: "/verify",
    label: "Verify Harness",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
];

export function App() {
  const [ai, setAi] = useState<AIHealth | null>(null);

  useEffect(() => {
    api<AIHealth>("/health/ai").then(setAi).catch(() => setAi(null));
  }, []);

  const aiOnline = ai?.available ?? false;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="brand-mark">AER</div>
          <div className="brand-text">
            <strong>AER System</strong>
            <span>Referee Core</span>
          </div>
        </div>

        {/* Context strip */}
        <div className="ctx-strip">
          <span className="ctx-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            CO3001
          </span>
          <span className="ctx-tag">HK261</span>
        </div>

        {/* Nav */}
        <div className="sidebar-section-label">Sinh viên</div>
        <nav>
          {navItems.slice(0, 2).map(({ path, label, icon }) => (
            <NavLink key={path} to={path} className={({ isActive }) => isActive ? "active" : ""}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section-label" style={{ marginTop: 10 }}>Hệ thống</div>
        <nav>
          {navItems.slice(2).map(({ path, label, icon }) => (
            <NavLink key={path} to={path} className={({ isActive }) => isActive ? "active" : ""}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="avatar">NV</div>
            <div className="sidebar-user-info">
              <strong>Nguyễn Văn An</strong>
              <span>2110482 · CO3001</span>
            </div>
            <span className={`ai-status-dot ${aiOnline ? "online" : "offline"}`} title={aiOnline ? "AI online" : "AI offline"} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/student"  element={<StudentPage />} />
          <Route path="/lecturer" element={<LecturerPage />} />
          <Route path="/audit"    element={<AuditPage />} />
          <Route path="/verify"   element={<VerifyPage />} />
          <Route path="*"         element={<Navigate to="/student" replace />} />
        </Routes>
      </main>
    </div>
  );
}
