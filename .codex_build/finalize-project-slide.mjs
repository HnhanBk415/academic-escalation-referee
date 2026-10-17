import path from "node:path";
import { finalizePresentation } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/Presentations/container_tools/artifact_tool_utils.mjs";

const workspaceDir = "D:/TRACK_VNGF/academic-escalation-referee";
const skillDir = "C:/Users/Nguyen Hoang Nhan/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/Presentations";
const finalPath = path.join(workspaceDir, "deliverables", "luong-xu-ly-yeu-cau-hoc-vu.pptx");
const receiptPath = path.join(workspaceDir, ".codex-finalizer", "luong-xu-ly-yeu-cau-hoc-vu.validation.json");

const result = await finalizePresentation({
  explicitTotalSlideCount: 1,
  workspaceDir,
  candidatePath: path.join(workspaceDir, ".codex_build", "project-draft.pptx"),
  finalPath,
  pythonExecutable: "C:/Users/Nguyen Hoang Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  fontPolicy: { basis: "design", families: ["Arial"] },
  verifyArtifactToolImport: true,
  receiptPath,
});

console.log(JSON.stringify(result, null, 2));
