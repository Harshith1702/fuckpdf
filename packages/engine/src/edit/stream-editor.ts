import * as mupdf from "mupdf";
import { encodePdfLiteralString } from "../parser/tokenizer.js";
import { parseTextRuns, TextRunInfo } from "../interpreter/stream-interpreter.js";

export function replaceTextRunInStream(
  content: string,
  targetRun: TextRunInfo,
  newText: string
): string {
  const replacement = `${encodePdfLiteralString(newText)} Tj`;
  const before = content.slice(0, targetRun.startOffset);
  const after = content.slice(targetRun.endOffset);
  return before + replacement + after;
}

export interface TextEditItem {
  pageIndex: number;
  runIndex?: number;
  originalText: string;
  newText: string;
}

export function applyEditsToPdfBytes(
  pdfBytes: Uint8Array,
  edits: TextEditItem[]
): Uint8Array {
  if (edits.length === 0) {
    return pdfBytes;
  }

  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf").asPDF();
  if (!doc) {
    throw new Error("Failed to load PDF bytes in MuPDF engine");
  }

  // Group edits by pageIndex
  const editsByPage = new Map<number, TextEditItem[]>();
  for (const edit of edits) {
    const list = editsByPage.get(edit.pageIndex) ?? [];
    list.push(edit);
    editsByPage.set(edit.pageIndex, list);
  }

  for (const [pageIndex, pageEdits] of editsByPage.entries()) {
    if (pageIndex < 0 || pageIndex >= doc.countPages()) continue;

    const pageObj = doc.findPage(pageIndex);
    const contentsObj = pageObj.get("Contents");
    if (!contentsObj) continue;

    interface StreamTarget {
      obj: mupdf.PDFObject;
      streamString: string;
      runs: TextRunInfo[];
      globalRunOffset: number;
    }

    const streamTargets: StreamTarget[] = [];

    if (contentsObj.isStream()) {
      const s = contentsObj.readStream().asString();
      streamTargets.push({
        obj: contentsObj,
        streamString: s,
        runs: parseTextRuns(s),
        globalRunOffset: 0,
      });
    } else if (contentsObj.isArray()) {
      const count = typeof contentsObj.length === "function" ? (contentsObj.length as any)() : contentsObj.length;
      let cumulativeRuns = 0;
      for (let i = 0; i < count; i++) {
        const item = contentsObj.get(i);
        if (item && item.isStream()) {
          const s = item.readStream().asString();
          const runs = parseTextRuns(s);
          streamTargets.push({
            obj: item,
            streamString: s,
            runs,
            globalRunOffset: cumulativeRuns,
          });
          cumulativeRuns += runs.length;
        }
      }
    }

    if (streamTargets.length === 0) continue;

    // Identify target replacement for each edit
    const tasksByStream = new Map<StreamTarget, { run: TextRunInfo; replacementText: string }[]>();

    for (const edit of pageEdits) {
      if (edit.originalText === edit.newText) continue;

      let matchedTarget: StreamTarget | undefined;
      let matchedRun: TextRunInfo | undefined;

      // 1. Try matching by runIndex
      if (edit.runIndex !== undefined && edit.runIndex >= 0) {
        for (const target of streamTargets) {
          const localIdx = edit.runIndex - target.globalRunOffset;
          if (localIdx >= 0 && localIdx < target.runs.length) {
            const candidate = target.runs[localIdx];
            if (candidate && (candidate.text === edit.originalText || candidate.text.includes(edit.originalText))) {
              matchedTarget = target;
              matchedRun = candidate;
              break;
            }
          }
        }
      }

      // 2. Fallback to exact text match
      if (!matchedRun) {
        for (const target of streamTargets) {
          const candidate = target.runs.find((r) => r.text === edit.originalText);
          if (candidate) {
            matchedTarget = target;
            matchedRun = candidate;
            break;
          }
        }
      }

      // 3. Fallback to substring match
      if (!matchedRun) {
        for (const target of streamTargets) {
          const candidate = target.runs.find((r) => r.text.includes(edit.originalText));
          if (candidate) {
            matchedTarget = target;
            matchedRun = candidate;
            break;
          }
        }
      }

      if (matchedTarget && matchedRun) {
        let replacementText = edit.newText;
        if (matchedRun.text !== edit.originalText && matchedRun.text.includes(edit.originalText)) {
          replacementText = matchedRun.text.replace(edit.originalText, edit.newText);
        }
        const tasks = tasksByStream.get(matchedTarget) ?? [];
        tasks.push({ run: matchedRun, replacementText });
        tasksByStream.set(matchedTarget, tasks);
      }
    }

    // Apply tasks per stream in descending order of startOffset
    for (const [target, tasks] of tasksByStream.entries()) {
      tasks.sort((a, b) => b.run.startOffset - a.run.startOffset);
      let updatedStream = target.streamString;
      for (const task of tasks) {
        updatedStream = replaceTextRunInStream(updatedStream, task.run, task.replacementText);
      }

      const mupdfBuf = new mupdf.Buffer();
      mupdfBuf.write(updatedStream);
      target.obj.writeStream(mupdfBuf);
    }
  }

  const outputBuf = doc.saveToBuffer("");
  const wasmBytes = outputBuf.asUint8Array();
  return new Uint8Array(wasmBytes.slice());
}
