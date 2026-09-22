import React, { useEffect, useState } from "react";
import { api } from "./api/client";
import { Sidebar, type ActiveTab, type Role } from "./components/Sidebar";
import { AuditPage } from "./pages/AuditPage";
import { ExceptionsView } from "./pages/ExceptionsView";
import { LecturerInboxView } from "./pages/LecturerInboxView";
import { StudentHistoryView } from "./pages/StudentHistoryView";
import { StudentSubmitView } from "./pages/StudentSubmitView";
import { VerifyPage } from "./pages/VerifyPage";
import type { AIHealth, CaseSummary, QuestionResponse } from "./types";

export function App() {
  const [role, setRole] = useState<Role>("student");
  const [activeTab, setActiveTab] = useState<ActiveTab>("submit");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [ai, setAi] = useState<AIHealth | null>(null);

  // Fetch AI health and initial badges
  const refreshCounts = async () => {
    try {
      // Check pending questions count
      const questions = await api<QuestionResponse[]>("/api/questions");
      if (Array.isArray(questions)) {
        const pending = questions.filter(
          (q) => q.route === "ESCALATE" && !q.final_decision
        ).length;
        setPendingCount(pending);
      }
    } catch {
      // ignore
    }

    try {
      // Check lecturer queue count
      const cases = await api<CaseSummary[]>("/api/cases?status=UNDER_REVIEW");
      if (Array.isArray(cases)) {
        setQueueCount(cases.length);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    api<AIHealth>("/health/ai")
      .then(setAi)
      .catch(() => setAi(null));
    refreshCounts();
  }, []);

  const handleSelectRole = (newRole: Role) => {
    setRole(newRole);
    if (newRole === "student") {
      setActiveTab("submit");
    } else {
      setActiveTab("inbox");
    }
  };

  // Smooth UX Transition from Screen 1 to Screen 2
  const handleQuestionSubmitted = (questionId: string) => {
    setSelectedQuestionId(questionId);
    setActiveTab("history");
    refreshCounts();
  };

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      {/* Fixed 260px Left Sidebar */}
      <Sidebar
        role={role}
        onSelectRole={handleSelectRole}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={pendingCount}
        queueCount={queueCount}
        aiOnline={ai?.available ?? false}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col min-w-0 bg-[#F8FAFC]">
        {activeTab === "submit" && (
          <StudentSubmitView onSubmitted={handleQuestionSubmitted} />
        )}
        {activeTab === "history" && (
          <StudentHistoryView initialSelectedId={selectedQuestionId} />
        )}
        {activeTab === "inbox" && (
          <LecturerInboxView onDecisionMade={refreshCounts} />
        )}
        {activeTab === "exceptions" && <ExceptionsView />}
        {activeTab === "audit" && (
          <div className="overflow-y-auto flex-1 p-8 bg-[#F8FAFC]">
            <AuditPage />
          </div>
        )}
        {activeTab === "verify" && (
          <div className="overflow-y-auto flex-1 p-8 bg-[#F8FAFC]">
            <VerifyPage />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
