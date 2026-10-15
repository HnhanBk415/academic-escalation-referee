import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api, setDemoActorId } from "./api/client";
import { AppHeader } from "./components/AppHeader";
import { PageContainer } from "./components/ui";
import { DEMO_ACCOUNTS, type DemoAccount } from "./components/AccountSwitcher";
import { HomePage } from "./pages/HomePage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { AuditPage } from "./pages/AuditPage";
import { VerifyPage } from "./pages/VerifyPage";
import type { AIHealth, DashboardCounts, DemoCatalog } from "./types";
import { groupLabel } from "./utils/labels";
import { TourProvider } from "./tour/TourContext";

const ACCOUNT_STORAGE_KEY = "aer_demo_account_id";

function getGroupStorageKey(actorId: string, courseId: string) {
  return `aer_selected_group:${actorId}:${courseId}`;
}

function getSavedGroupForAccountCourse(actorId: string, courseId: string): string | null {
  try {
    return localStorage.getItem(getGroupStorageKey(actorId, courseId));
  } catch {
    return null;
  }
}

function saveGroupForAccountCourse(actorId: string, courseId: string, groupId: string) {
  try {
    if (groupId) {
      localStorage.setItem(getGroupStorageKey(actorId, courseId), groupId);
    } else {
      localStorage.removeItem(getGroupStorageKey(actorId, courseId));
    }
  } catch {
    // ignore
  }
}

function resolveSelectedGroup(
  account: DemoAccount,
  courseId: string,
  catalog: DemoCatalog | null
): string {
  const targetCourse = catalog?.courses.find((c) => c.id === courseId);
  const courseGroups = targetCourse?.groups ?? [];

  // 1. Check saved group in localStorage
  const savedGroupId = getSavedGroupForAccountCourse(account.id, courseId);
  if (savedGroupId) {
    if (courseGroups.length > 0) {
      if (courseGroups.some((g) => g.id === savedGroupId)) {
        return savedGroupId;
      }
    } else if (!catalog) {
      return savedGroupId;
    }
  }

  // 2. Check if account is member of a group in this course from catalog
  if (courseGroups.length > 0) {
    const memberGroup = courseGroups.find((g) =>
      (g as unknown as { member_ids?: string[] }).member_ids?.includes(account.id)
    );
    if (memberGroup) {
      return memberGroup.id;
    }
  }

  // 3. Default account group for this course if matches
  if (account.courseId === courseId && account.groupId) {
    if (courseGroups.length === 0 || courseGroups.some((g) => g.id === account.groupId)) {
      return account.groupId;
    }
  }

  // 4. Fallback to first group of the course
  if (courseGroups.length > 0) {
    return courseGroups[0].id;
  }

  return "";
}

function getInitialAccount(): DemoAccount {
  let acc = DEMO_ACCOUNTS[0]; // student-a1 by default
  try {
    const savedId = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (savedId) {
      const found = DEMO_ACCOUNTS.find((a) => a.id === savedId);
      if (found) acc = found;
    }
  } catch {
    // ignore localStorage errors
  }
  setDemoActorId(acc.id);
  return acc;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentAccount, setCurrentAccount] = useState<DemoAccount>(getInitialAccount);
  const [catalog, setCatalog] = useState<DemoCatalog | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(currentAccount.courseId);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() =>
    resolveSelectedGroup(currentAccount, currentAccount.courseId, null)
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [ai, setAi] = useState<AIHealth | null>(null);

  // Sync demo actor ID to client on startup and account change
  useEffect(() => {
    setDemoActorId(currentAccount.id);
    try {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, currentAccount.id);
    } catch {
      // ignore
    }
  }, [currentAccount]);

  // Load demo catalog with retry (up to 5 times, every 3s)
  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function loadCatalog() {
      try {
        const data = await api<DemoCatalog>("/api/v1/demo/catalog");
        if (cancelled) return;
        setCatalog(data);
        if (data.courses && data.courses.length > 0) {
          setSelectedCourseId((prevCourseId) => {
            const validCourseId =
              prevCourseId && data.courses.some((c) => c.id === prevCourseId)
                ? prevCourseId
                : data.courses[0].id;

            setSelectedGroupId((prevGroupId) => {
              const currentCourse = data.courses.find((c) => c.id === validCourseId);
              const courseGroups = currentCourse?.groups ?? [];
              if (prevGroupId && courseGroups.some((g) => g.id === prevGroupId)) {
                saveGroupForAccountCourse(currentAccount.id, validCourseId, prevGroupId);
                return prevGroupId;
              }
              const resolved = resolveSelectedGroup(currentAccount, validCourseId, data);
              saveGroupForAccountCourse(currentAccount.id, validCourseId, resolved);
              return resolved;
            });

            return validCourseId;
          });
        }
      } catch (err) {
        console.warn("Could not load demo catalog", err);
        attempts += 1;
        if (!cancelled && attempts < 5) {
          timer = setTimeout(() => {
            void loadCatalog();
          }, 3000);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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

    // Keep current course if valid in catalog, else fallback to account.courseId
    const targetCourseId =
      selectedCourseId && catalog?.courses.some((c) => c.id === selectedCourseId)
        ? selectedCourseId
        : account.courseId;
    setSelectedCourseId(targetCourseId);

    const resolvedGroup = resolveSelectedGroup(account, targetCourseId, catalog);
    setSelectedGroupId(resolvedGroup);
    saveGroupForAccountCourse(account.id, targetCourseId, resolvedGroup);

    const defaultFeature = account.role === "student" ? "ask" : "inbox";
    navigate(`/workspace/${defaultFeature}`);
    void refreshCounts();
  };

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    const resolvedGroup = resolveSelectedGroup(currentAccount, courseId, catalog);
    setSelectedGroupId(resolvedGroup);
    saveGroupForAccountCourse(currentAccount.id, courseId, resolvedGroup);
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    saveGroupForAccountCourse(currentAccount.id, selectedCourseId, groupId);
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

  const activeGroupLabel = (() => {
    if (currentAccount.role !== "student") return undefined;
    const currentCourse = catalog?.courses.find((c) => c.id === selectedCourseId);
    const currentGroup = currentCourse?.groups.find((g) => g.id === selectedGroupId);
    if (currentGroup) {
      return currentGroup.name.includes(" - ")
        ? currentGroup.name.split(" - ")[0].trim()
        : currentGroup.name.trim();
    }
    return groupLabel(selectedGroupId, catalog);
  })();

  return (
    <TourProvider currentRole={currentAccount.role}>
      <div className="flex flex-col min-h-screen w-full bg-[var(--surface-dim)] text-[var(--on-surface)] overflow-x-hidden font-sans">
      {/* Top Header */}
      <AppHeader
        currentAccountId={currentAccount.id}
        currentRole={currentAccount.role}
        aiOnline={ai?.available ?? false}
        onSelectAccount={handleSelectAccount}
        activeGroupLabel={activeGroupLabel}
      />

      {/* Main Content View with Routes */}
      <main className="flex-1 flex flex-col min-w-0 pt-16">
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
              <div className="flex-1 overflow-y-auto py-6">
                <PageContainer variant="wide">
                  <AuditPage />
                </PageContainer>
              </div>
            }
          />

          {/* Verify Harness Route */}
          <Route
            path="/verify"
            element={
              <div className="flex-1 overflow-y-auto py-6">
                <PageContainer variant="wide">
                  <VerifyPage />
                </PageContainer>
              </div>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  </TourProvider>
  );
}

export default App;
