import React from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
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
    <div className="relative min-h-[calc(100vh-64px)] flex-1 flex flex-col bg-[var(--surface-dim)]">
      {/* Floating Left Rail */}
      <WorkspaceRail
        role={role}
        pendingCount={pendingCount}
        queueCount={queueCount}
      />

      {/* Main Workspace Content */}
      <div
        className={`flex-1 md:pl-[88px] ${
          feature === "history" ? "p-0" : "pr-4 sm:pr-8 py-6 pb-20 md:pb-8 max-w-7xl mx-auto"
        } w-full overflow-y-auto flex flex-col`}
      >
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
          <ExceptionsView />
        )}

        {role === "lecturer" && feature === "documents" && (
          <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] p-6 border border-[var(--outline)]/40 shadow-xs">
            <DocumentProcessingPage courseId={selectedCourseId} />
          </div>
        )}
      </div>
    </div>
  );
}
