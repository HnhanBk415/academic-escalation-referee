import React, { useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { PanelLeftOpen } from "lucide-react";
import { WorkspaceRail } from "../components/WorkspaceRail";
import { StudentSubmitView } from "./StudentSubmitView";
import { StudentHistoryView } from "./StudentHistoryView";
import { LecturerInboxView } from "./LecturerInboxView";
import { ExceptionsView } from "./ExceptionsView";
import { DocumentProcessingPage } from "./DocumentProcessingPage";
import type { DemoCatalog } from "../types";

interface WorkspacePageProps {
  actorId: string;
  role: "student" | "lecturer";
  catalog: DemoCatalog | null;
  selectedCourseId: string;
  selectedGroupId: string;
  onSelectCourse: (courseId: string) => void;
  onSelectGroup: (groupId: string) => void;
  selectedQuestionId?: string;
  onQuestionSubmitted: (questionId: string) => void;
  onDecisionMade: () => void;
  pendingCount: number;
  queueCount: number;
}

export function WorkspacePage({
  actorId,
  role,
  catalog,
  selectedCourseId,
  selectedGroupId,
  onSelectCourse,
  onSelectGroup,
  selectedQuestionId,
  onQuestionSubmitted,
  onDecisionMade,
  pendingCount,
  queueCount,
}: WorkspacePageProps) {
  const { feature } = useParams<{ feature: string }>();
  const navigate = useNavigate();

  // Sidebar collapse state with localStorage persistence
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("aer_workspace_sidebar_open");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aer_workspace_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Validate allowed features per role
  const studentFeatures = ["ask", "history"];
  const lecturerFeatures = ["inbox", "exceptions", "documents"];

  if (role === "student" && (!feature || !studentFeatures.includes(feature))) {
    return <Navigate to="/workspace/ask" replace />;
  }

  if (role === "lecturer" && (!feature || !lecturerFeatures.includes(feature))) {
    return <Navigate to="/workspace/inbox" replace />;
  }

  const handleNavigateToHistory = (questionId: string) => {
    onQuestionSubmitted(questionId);
    navigate(`/workspace/history/${questionId}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex-1 flex flex-col bg-[#faf7f8]">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-5 pt-4 pb-10">
          {/* Collapsible Sidebar */}
          {isSidebarOpen && (
            <WorkspaceRail
              role={role}
              pendingCount={pendingCount}
              queueCount={queueCount}
              onToggleCollapse={handleToggleSidebar}
            />
          )}

          {/* Main Workspace Content Area */}
          <div className="flex-1 min-w-0">
            {/* If sidebar is collapsed, provide an un-collapse button */}
            {!isSidebarOpen && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={handleToggleSidebar}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 bg-white hover:bg-rose-50 text-stone-700 hover:text-ruby-800 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  title="Mở thanh danh mục bên trái"
                >
                  <PanelLeftOpen size={15} />
                  <span>Mở danh mục</span>
                </button>
              </div>
            )}

            {role === "student" && feature === "ask" && (
              <StudentSubmitView
                actorId={actorId}
                catalog={catalog}
                selectedCourseId={selectedCourseId}
                selectedGroupId={selectedGroupId}
                onSelectCourse={onSelectCourse}
                onSelectGroup={onSelectGroup}
                onSubmitted={onQuestionSubmitted}
                onViewHistory={handleNavigateToHistory}
              />
            )}

            {role === "student" && feature === "history" && (
              <StudentHistoryView
                actorId={actorId}
                catalog={catalog}
                selectedCourseId={selectedCourseId}
                selectedGroupId={selectedGroupId}
              />
            )}

            {role === "lecturer" && feature === "inbox" && (
              <LecturerInboxView onDecisionMade={onDecisionMade} />
            )}

            {role === "lecturer" && feature === "exceptions" && (
              <ExceptionsView actorId={actorId} />
            )}

            {role === "lecturer" && feature === "documents" && (
              <DocumentProcessingPage courseId={selectedCourseId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
