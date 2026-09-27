import React, { useEffect, useState } from "react";
import { api } from "./api/client";
import { Sidebar, type ActiveTab, type Role } from "./components/Sidebar";
import { AuditPage } from "./pages/AuditPage";
import { ExceptionsView } from "./pages/ExceptionsView";
import { LecturerInboxView } from "./pages/LecturerInboxView";
import { StudentHistoryView } from "./pages/StudentHistoryView";
import { StudentSubmitView } from "./pages/StudentSubmitView";
import { VerifyPage } from "./pages/VerifyPage";
import type { AIHealth, DashboardCounts } from "./types";

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
      const counts = await api<DashboardCounts>("/api/questions/counts");
      setPendingCount(counts.pending_questions);
      setQueueCount(counts.under_review_cases);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const checkHealth = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(checkHealth, 30000);
        return;
      }
      try {
        const health = await api<AIHealth>("/health/ai");
        if (!cancelled) {
          setAi(health);
          await refreshCounts();
        }
      } catch {
        if (!cancelled) setAi(null);
      } finally {
        if (!cancelled) timer = setTimeout(checkHealth, 30000);
      }
    };

    void checkHealth();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleSelectRole = (newRole: Role) => {
    setRole(newRole);
    if (newRole === "student") {
      setActiveTab("submit");
    } else {
      setActiveTab("inbox");
    }
  };

  const handleQuestionSubmitted = (questionId: string) => {
    setSelectedQuestionId(questionId);
    refreshCounts();
  };

  const handleNavigateToHistory = (questionId: string) => {
    setSelectedQuestionId(questionId);
    setActiveTab("history");
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
          <StudentSubmitView
            onSubmitted={handleQuestionSubmitted}
            onViewHistory={handleNavigateToHistory}
          />
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
