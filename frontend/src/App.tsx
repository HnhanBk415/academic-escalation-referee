import React, { useEffect, useState } from "react";
import { api } from "./api/client";
import { Sidebar, type ActiveTab, type Role } from "./components/Sidebar";
import { AuditPage } from "./pages/AuditPage";
import { ExceptionsView } from "./pages/ExceptionsView";
import { LecturerInboxView } from "./pages/LecturerInboxView";
import { StudentHistoryView } from "./pages/StudentHistoryView";
import { StudentSubmitView } from "./pages/StudentSubmitView";
import { VerifyPage } from "./pages/VerifyPage";
import type { AIHealth, DashboardCounts, DemoCatalog } from "./types";

export function App() {
  const [role, setRole] = useState<Role>("student");
  const [activeTab, setActiveTab] = useState<ActiveTab>("submit");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [ai, setAi] = useState<AIHealth | null>(null);

  // Global Demo Catalog & Course/Group Context
  const [catalog, setCatalog] = useState<DemoCatalog | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  useEffect(() => {
    async function loadCatalog() {
      try {
        const data = await api<DemoCatalog>("/api/v1/demo/catalog");
        setCatalog(data);
        if (data.courses && data.courses.length > 0) {
          setSelectedCourseId((prev) => prev || data.courses[0].id);
          if (data.courses[0].groups && data.courses[0].groups.length > 0) {
            setSelectedGroupId((prev) => prev || data.courses[0].groups[0].id);
          }
        }
      } catch (err) {
        console.warn("Could not load demo catalog", err);
      }
    }
    void loadCatalog();
  }, []);

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    // Khi đổi môn thì xóa nhóm đã chọn và tải nhóm của môn mới
    setSelectedGroupId("");
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  // Fetch AI health and initial badges
  const refreshCounts = async () => {
    try {
      const counts = await api<DashboardCounts>("/api/v1/questions/counts");
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
            catalog={catalog}
            selectedCourseId={selectedCourseId}
            selectedGroupId={selectedGroupId}
            onSelectCourse={handleSelectCourse}
            onSelectGroup={handleSelectGroup}
            onSubmitted={handleQuestionSubmitted}
            onViewHistory={handleNavigateToHistory}
          />
        )}
        {activeTab === "history" && (
          <StudentHistoryView
            initialSelectedId={selectedQuestionId}
            catalog={catalog}
            selectedCourseId={selectedCourseId}
            selectedGroupId={selectedGroupId}
          />
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
