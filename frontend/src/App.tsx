import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api, setDemoActorId } from "./api/client";
import { AppHeader } from "./components/AppHeader";
import { DEMO_ACCOUNTS, type DemoAccount } from "./components/AccountSwitcher";
import { HomePage } from "./pages/HomePage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { AuditPage } from "./pages/AuditPage";
import { VerifyPage } from "./pages/VerifyPage";
import type { AIHealth, DashboardCounts, DemoCatalog } from "./types";

const STORAGE_KEY = "aer_demo_account_id";

function getInitialAccount(): DemoAccount {
  try {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const found = DEMO_ACCOUNTS.find((a) => a.id === savedId);
      if (found) return found;
    }
  } catch {
    // ignore localStorage errors
  }
  return DEMO_ACCOUNTS[0]; // student-a1 by default
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentAccount, setCurrentAccount] = useState<DemoAccount>(getInitialAccount);
  const [catalog, setCatalog] = useState<DemoCatalog | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(currentAccount.courseId);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(currentAccount.groupId || "");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [ai, setAi] = useState<AIHealth | null>(null);

  // Sync demo actor ID to client on startup and account change
  useEffect(() => {
    setDemoActorId(currentAccount.id);
    try {
      localStorage.setItem(STORAGE_KEY, currentAccount.id);
    } catch {
      // ignore
    }
  }, [currentAccount]);

  // Load demo catalog
  useEffect(() => {
    async function loadCatalog() {
      try {
        const data = await api<DemoCatalog>("/api/v1/demo/catalog");
        setCatalog(data);
        if (data.courses && data.courses.length > 0) {
          if (!selectedCourseId) {
            setSelectedCourseId(data.courses[0].id);
          }
        }
      } catch (err) {
        console.warn("Could not load demo catalog", err);
      }
    }
    void loadCatalog();
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await api<DashboardCounts>("/api/v1/questions/counts");
      setPendingCount(counts.pending_questions);
      setQueueCount(counts.under_review_cases);
    } catch {
      // ignore
    }
  }, []);

  // Poll AI health and refresh counts
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
  }, [refreshCounts]);

  // Handle switching account from the AccountSwitcher
  const handleSelectAccount = (account: DemoAccount) => {
    setCurrentAccount(account);
    setDemoActorId(account.id);
    setSelectedCourseId(account.courseId);
    setSelectedGroupId(account.groupId || "");

    const defaultFeature = account.role === "student" ? "ask" : "inbox";
    navigate(`/workspace/${defaultFeature}`);
    void refreshCounts();
  };

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedGroupId("");
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  const handleQuestionSubmitted = (questionId: string) => {
    setSelectedQuestionId(questionId);
    void refreshCounts();
  };

  const handleHomeNavigate = (destination: string) => {
    if (destination === "submit") navigate("/workspace/ask");
    else if (destination === "history") navigate("/workspace/history");
    else if (destination === "inbox") navigate("/workspace/inbox");
    else if (destination === "exceptions") navigate("/workspace/exceptions");
    else if (destination === "audit") navigate("/audit");
    else if (destination === "operations") navigate("/workspace/inbox");
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[var(--surface-dim)] text-[var(--on-surface)] overflow-x-hidden font-sans">
      {/* Top Header */}
      <AppHeader
        currentAccountId={currentAccount.id}
        currentRole={currentAccount.role}
        aiOnline={ai?.available ?? false}
        onSelectAccount={handleSelectAccount}
      />

      {/* Main Content View with Routes */}
      <main className="flex-1 flex flex-col min-w-0">
        <Routes>
          {/* Home Route */}
          <Route
            path="/"
            element={
              <div className="flex-1 overflow-y-auto">
                <HomePage
                  role={currentAccount.role}
                  catalog={catalog}
                  selectedCourseId={selectedCourseId}
                  aiOnline={ai?.available ?? false}
                  onNavigate={handleHomeNavigate}
                />
              </div>
            }
          />

          {/* Workspace Routes */}
          <Route
            path="/workspace/:feature/:questionId"
            element={
              <WorkspacePage
                actorId={currentAccount.id}
                role={currentAccount.role}
                catalog={catalog}
                selectedCourseId={selectedCourseId}
                selectedGroupId={selectedGroupId}
                onSelectCourse={handleSelectCourse}
                onSelectGroup={handleSelectGroup}
                selectedQuestionId={selectedQuestionId}
                onQuestionSubmitted={handleQuestionSubmitted}
                onDecisionMade={refreshCounts}
                pendingCount={pendingCount}
                queueCount={queueCount}
              />
            }
          />
          <Route
            path="/workspace/:feature"
            element={
              <WorkspacePage
                actorId={currentAccount.id}
                role={currentAccount.role}
                catalog={catalog}
                selectedCourseId={selectedCourseId}
                selectedGroupId={selectedGroupId}
                onSelectCourse={handleSelectCourse}
                onSelectGroup={handleSelectGroup}
                selectedQuestionId={selectedQuestionId}
                onQuestionSubmitted={handleQuestionSubmitted}
                onDecisionMade={refreshCounts}
                pendingCount={pendingCount}
                queueCount={queueCount}
              />
            }
          />
          <Route
            path="/workspace"
            element={
              <Navigate
                to={`/workspace/${currentAccount.role === "student" ? "ask" : "inbox"}`}
                replace
              />
            }
          />

          {/* Audit Log Route */}
          <Route
            path="/audit"
            element={
              <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
                <AuditPage />
              </div>
            }
          />

          {/* Verify Harness Route */}
          <Route
            path="/verify"
            element={
              <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
                <VerifyPage />
              </div>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
