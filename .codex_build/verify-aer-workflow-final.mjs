import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "file:///C:/Users/Nguyen%20Hoang%20Nhan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const path = "D:/TRACK_VNGF/academic-escalation-referee/deliverables/aer-question-workflow.pptx";
const deck = await PresentationFile.importPptx(await FileBlob.load(path));
const inspection = await deck.inspect({ kind: "slide,textbox,shape", maxChars: 16000 });
console.log(inspection.ndjson);
for (const [index, slide] of deck.slides.items.entries()) {
  const png = await deck.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(`D:/TRACK_VNGF/academic-escalation-referee/.codex_build/aer-workflow-final-${String(index + 1).padStart(2, "0")}.png`, new Uint8Array(await png.arrayBuffer()));
}
