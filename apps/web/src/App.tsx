import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { AuditPage } from "./pages/AuditPage";
import { LecturerPage } from "./pages/LecturerPage";
import { StudentPage } from "./pages/StudentPage";
import { VerifyPage } from "./pages/VerifyPage";

const navItems = [
  ["/student", "Student"],
  ["/lecturer", "Lecturer"],
  ["/audit", "Audit"],
  ["/verify", "Verify"]
];

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">AER</div>
        <div className="brand-copy">
          <strong>Academic</strong>
          <span>Escalation Referee</span>
        </div>
        <nav>
          {navItems.map(([path, label]) => (
            <NavLink key={path} to={path} className={({ isActive }) => isActive ? "active" : ""}>
              <span className="nav-dot" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-light" />
          Gemini · CO3001
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/student" element={<StudentPage />} />
          <Route path="/lecturer" element={<LecturerPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </main>
    </div>
  );
}
