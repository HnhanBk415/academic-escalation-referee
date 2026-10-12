import React, { useEffect, useState } from "react";
import { api, hasAccessToken, setAccessToken, setDemoActorId } from "./api/client";
import { Sidebar, type ActiveTab, type Role } from "./components/Sidebar";
import { AuditPage } from "./pages/AuditPage";
import { ExceptionsView } from "./pages/ExceptionsView";
import { HomePage } from "./pages/HomePage";
import { LecturerInboxView } from "./pages/LecturerInboxView";
import { DocumentProcessingPage } from "./pages/DocumentProcessingPage";
import { LoginPage, type AuthActor } from "./pages/LoginPage";
import { OperationsPage } from "./pages/OperationsPage";
import { StudentHistoryView } from "./pages/StudentHistoryView";
import { StudentSubmitView } from "./pages/StudentSubmitView";
import { VerifyPage } from "./pages/VerifyPage";
import type { AIHealth, DashboardCounts, DemoCatalog } from "./types";

export function App() {
  const [role, setRole] = useState<Role>("student");
  const [authenticatedActor, setAuthenticatedActor] = useState<AuthActor | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [ai, setAi] = useState<AIHealth | null>(null);

  // Global Demo Catalog & Course/Group Context
  const [catalog, setCatalog] = useState<DemoCatalog | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  useEffect(() => {
    setDemoActorId(
      role === "student"
        ? "demo-student"
        : role === "lecturer"
          ? "lecturer-01"
          : "academic-affairs-01",
    );
  }, [role]);

  useEffect(() => {
    async function restoreSession() {
      try {
        const actor = await api<AuthActor>("/api/v1/auth/me");
        setAuthenticatedActor(actor);
        setRole(
          actor.role === "STUDENT"
            ? "student"
            : actor.role === "LECTURER"
              ? "lecturer"
              : "academic_affairs",
        );
      } catch {
        if (hasAccessToken()) setAccessToken(null);
        setAuthenticatedActor(null);
      }
    }
    void restoreSession();
  }, []);

  useEffect(() => {
    async function loadCatalog() {
      if (!authenticatedActor) return;
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
  }, [authenticatedActor]);

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
    if (!authenticatedActor) return;
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
  }, [authenticatedActor]);

  const handleSelectRole = (newRole: Role) => {
    setRole(newRole);
    setActiveTab("home");
  };

  const handleLoggedIn = (actor: AuthActor) => {
    setAuthenticatedActor(actor);
    setRole(
      actor.role === "STUDENT"
        ? "student"
        : actor.role === "LECTURER"
          ? "lecturer"
          : "academic_affairs",
    );
  };

  const handleQuestionSubmitted = (questionId: string) => {
    setSelectedQuestionId(questionId);
    refreshCounts();
  };

  const handleNavigateToHistory = (questionId: string) => {
    setSelectedQuestionId(questionId);
    setActiveTab("history");
  };

  if (authenticatedActor === undefined) {
    return <main className="grid h-screen place-items-center bg-slate-950 text-sm text-slate-300">Đang kiểm tra phiên đăng nhập...</main>;
  }

  if (authenticatedActor === null) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

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
        allowRoleSwitch={!hasAccessToken()}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col min-w-0 bg-[#F8FAFC]">
        {activeTab === "home" && (
          <HomePage
            role={role}
            catalog={catalog}
            selectedCourseId={selectedCourseId}
            aiOnline={ai?.available ?? false}
            onNavigate={setActiveTab}
          />
        )}
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
        {activeTab === "documents" && (
          <div className="overflow-y-auto flex-1 p-8 bg-[#F8FAFC]">
            <DocumentProcessingPage courseId={selectedCourseId} />
          </div>
        )}
        {activeTab === "exceptions" && <ExceptionsView />}
        {activeTab === "operations" && <OperationsPage onOpenAudit={() => setActiveTab("audit")} />}
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
