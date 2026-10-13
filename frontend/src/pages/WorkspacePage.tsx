import React from "react";
import { useParams, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { WorkspaceRail } from "../components/WorkspaceRail";
import { PageContainer } from "../components/ui";
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isReadingMode = searchParams.get("read") === "1";

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

  const isTwoColumn = feature === "history" || feature === "inbox";

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex-1 flex flex-col bg-[var(--surface-dim)]">
      {/* Floating Left Rail */}
      {!isReadingMode && (
        <WorkspaceRail
          role={role}
          pendingCount={pendingCount}
          queueCount={queueCount}
        />
      )}

      {/* Main Workspace Content */}
      <div
        className={`flex-1 ${isReadingMode ? "pl-0" : "md:pl-[5.5rem]"} w-full flex flex-col ${
          isTwoColumn ? "h-[calc(100vh-4rem)] overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {role === "student" && feature === "ask" && (
          <PageContainer variant="reading" className="py-6 pb-20 md:pb-8 flex-1">
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
          </PageContainer>
        )}

        {role === "student" && feature === "history" && (
          <PageContainer variant="wide" className="h-full p-0 flex-1 flex flex-col overflow-hidden">
            <StudentHistoryView
              actorId={actorId}
              catalog={catalog}
              selectedCourseId={selectedCourseId}
              selectedGroupId={selectedGroupId}
            />
          </PageContainer>
        )}

        {role === "lecturer" && feature === "inbox" && (
          <PageContainer variant="wide" className="h-full p-0 flex-1 flex flex-col overflow-hidden">
            <LecturerInboxView onDecisionMade={onDecisionMade} />
          </PageContainer>
        )}

        {role === "lecturer" && feature === "exceptions" && (
          <PageContainer variant="wide" className="py-6 pb-20 md:pb-8 flex-1">
            <ExceptionsView actorId={actorId} />
          </PageContainer>
        )}

        {role === "lecturer" && feature === "documents" && (
          <PageContainer variant="wide" className="py-6 pb-20 md:pb-8 flex-1">
            <DocumentProcessingPage courseId={selectedCourseId} />
          </PageContainer>
        )}
      </div>
    </div>
  );
}
