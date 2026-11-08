import React, { useState, useEffect, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { TextRun, HistoryManager, TextEditOperation } from "@pdf-editor/core";
import { applyEditsToPdfBytes } from "@pdf-editor/engine";
import { Toolbar } from "./components/Toolbar.js";
import { Sidebar } from "./components/Sidebar.js";
import { PdfViewer } from "./components/PdfViewer.js";
import { StatusBar } from "./components/StatusBar.js";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export const App: React.FC = () => {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [documentName, setDocumentName] = useState<string>("simple-word.pdf");
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.25);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [textRuns, setTextRuns] = useState<TextRun[]>([]);
  const [activeRun, setActiveRun] = useState<TextRun | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Undo/Redo & Edits tracking
  const historyRef = useRef<HistoryManager>(new HistoryManager());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [editsMap, setEditsMap] = useState<Map<string, { pageIndex: number; runIndex?: number; originalText: string; newText: string }>>(
    new Map()
  );

  const updateHistoryState = () => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load PDF Bytes into PDF.js
  const loadPdf = useCallback(async (bytes: Uint8Array, name: string) => {
    try {
      const storageBytes = new Uint8Array(bytes.slice());
      setOriginalPdfBytes(storageBytes);
      setPdfBytes(new Uint8Array(storageBytes.slice()));
      setDocumentName(name);

      const workerBytes = new Uint8Array(storageBytes.slice());
      const loadingTask = pdfjsLib.getDocument({ data: workerBytes });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      setPageIndex(0);

      historyRef.current.clear();
      setEditsMap(new Map());
      updateHistoryState();
    } catch (err) {
      console.error("Failed to load PDF:", err);
      alert("Error loading PDF document. Please check the file format.");
    }
  }, []);

  // Extract Text Runs for the current page
  const extractTextRuns = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageIdx: number, scale: number) => {
    try {
      const page = await doc.getPage(pageIdx + 1);
      const viewport = page.getViewport({ scale });
      const textContent = await page.getTextContent();
      const styles = (textContent.styles || {}) as Record<string, { fontFamily: string; ascent?: number; descent?: number }>;

      const runs: TextRun[] = [];
      let idx = 0;

      for (const item of textContent.items) {
        if ("str" in item && item.str.trim() !== "") {
          const transform = item.transform; // [scaleX, skewY, skewX, scaleY, tx, ty]
          const tx = transform[4];
          const ty = transform[5];
          const fontSize = Math.hypot(transform[0], transform[1]);

          const fontStyle = styles[item.fontName];
          const ascent = fontStyle?.ascent ?? 0.76;
          const descent = fontStyle?.descent ?? -0.22;
          const heightRatio = Math.max(0.65, ascent - descent);

          const lowerFont = (item.fontName || "").toLowerCase();
          const isSerif =
            fontStyle?.fontFamily === "serif" ||
            lowerFont.includes("times") ||
            lowerFont.includes("roman") ||
            lowerFont.includes("cambria") ||
            lowerFont.includes("georgia") ||
            lowerFont.includes("cmr") ||
            lowerFont.includes("minion");

          const isMono =
            fontStyle?.fontFamily === "monospace" ||
            lowerFont.includes("courier") ||
            lowerFont.includes("mono") ||
            lowerFont.includes("consolas");

          const isBold =
            lowerFont.includes("bold") ||
            lowerFont.includes("black") ||
            lowerFont.includes("heavy") ||
            lowerFont.includes("b-");

          const isItalic =
            lowerFont.includes("italic") ||
            lowerFont.includes("oblique");

          const fontFamily = isMono
            ? "ui-monospace, monospace"
            : isSerif
            ? '"Times New Roman", Times, Georgia, serif'
            : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

          // Convert PDF points (bottom-left) to Viewport pixels (top-left)
          const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
          const scaledWidth = Math.max(item.width * scale, 12);
          const boxTop = vy - fontSize * scale * ascent;
          const boxHeight = fontSize * scale * heightRatio;

          const currentIdx = idx++;
          const runId = `p${pageIdx}-r${currentIdx}`;
          const existingEdit = editsMap.get(runId);
          const currentText = existingEdit ? existingEdit.newText : item.str;

          runs.push({
            id: runId,
            runIndex: currentIdx,
            pageIndex: pageIdx,
            text: currentText,
            originalText: item.str,
            bounds: {
              x: vx,
              y: boxTop,
              width: scaledWidth,
              height: boxHeight,
              baselineY: vy,
            },
            fontName: item.fontName || "Helvetica",
            fontFamily,
            fontSize,
            isBold,
            isItalic,
          });
        }
      }

      setTextRuns(runs);
    } catch (err) {
      console.error("Failed to extract text runs:", err);
    }
  }, [editsMap]);

  // Update text runs when page or zoom changes
  useEffect(() => {
    if (pdfDoc) {
      extractTextRuns(pdfDoc, pageIndex, zoom);
    }
  }, [pdfDoc, pageIndex, zoom, extractTextRuns]);

  // Load default fixture on startup
  useEffect(() => {
    const loadDefaultFixture = async () => {
      try {
        const response = await fetch("/fixtures/pdfs/simple-word.pdf");
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          loadPdf(new Uint8Array(buffer), "simple-word.pdf");
        } else {
          loadPdf(new Uint8Array([]), "Empty Document");
        }
      } catch {
        // Fallback
      }
    };
    loadDefaultFixture();
  }, [loadPdf]);

  // File Picker & Drop Handlers
  const handleOpenFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        loadPdf(new Uint8Array(buffer), file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Re-render PDF with updated content stream
  const applyEditsAndReloadDoc = async (
    nextEdits: Map<string, { pageIndex: number; runIndex?: number; originalText: string; newText: string }>
  ) => {
    if (!originalPdfBytes) return;
    try {
      const editsList = Array.from(nextEdits.values());
      const updatedBytes = applyEditsToPdfBytes(new Uint8Array(originalPdfBytes.slice()), editsList);
      setPdfBytes(updatedBytes);

      const workerBytes = new Uint8Array(updatedBytes.slice());
      const doc = await pdfjsLib.getDocument({ data: workerBytes }).promise;
      setPdfDoc(doc);
    } catch (err) {
      console.error("Failed to re-render native edited PDF:", err);
    }
  };

  // Text Edit Handling
  const handleUpdateTextRun = (runId: string, newText: string, previousText: string) => {
    const targetRun = textRuns.find((r) => r.id === runId);
    if (!targetRun || targetRun.text === newText) return;

    // Record edit in history
    const op: TextEditOperation = {
      type: "text-edit",
      runId,
      runIndex: targetRun.runIndex,
      pageIndex,
      previousText,
      newText,
      timestamp: Date.now(),
    };
    historyRef.current.push(op);
    updateHistoryState();

    const nextEdits = new Map(editsMap);
    if (newText === targetRun.originalText) {
      nextEdits.delete(runId);
    } else {
      nextEdits.set(runId, {
        pageIndex,
        runIndex: targetRun.runIndex,
        originalText: targetRun.originalText,
        newText,
      });
    }
    setEditsMap(nextEdits);

    // Re-render native PDF page
    applyEditsAndReloadDoc(nextEdits);
  };

  // Undo / Redo Handlers
  const handleUndo = () => {
    const op = historyRef.current.undo();
    if (op && op.type === "text-edit") {
      const nextEdits = new Map(editsMap);
      const target = textRuns.find((r) => r.id === op.runId);
      if (target) {
        if (op.previousText === target.originalText) {
          nextEdits.delete(op.runId);
        } else {
          nextEdits.set(op.runId, {
            pageIndex: op.pageIndex,
            runIndex: op.runIndex ?? target.runIndex,
            originalText: target.originalText,
            newText: op.previousText,
          });
        }
      }
      setEditsMap(nextEdits);
      updateHistoryState();
      applyEditsAndReloadDoc(nextEdits);
    }
  };

  const handleRedo = () => {
    const op = historyRef.current.redo();
    if (op && op.type === "text-edit") {
      const nextEdits = new Map(editsMap);
      const target = textRuns.find((r) => r.id === op.runId);
      if (target) {
        nextEdits.set(op.runId, {
          pageIndex: op.pageIndex,
          runIndex: op.runIndex ?? target.runIndex,
          originalText: target.originalText,
          newText: op.newText,
        });
      }
      setEditsMap(nextEdits);
      updateHistoryState();
      applyEditsAndReloadDoc(nextEdits);
    }
  };

  // Keyboard Shortcuts for Undo/Redo & Zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Export PDF with native content stream edits
  const handleExport = async () => {
    if (!originalPdfBytes) return;
    setIsExporting(true);

    try {
      const editsList = Array.from(editsMap.values());
      const bytesToEdit = new Uint8Array(originalPdfBytes.slice());
      const editedBytes = applyEditsToPdfBytes(bytesToEdit, editsList);

      const bufferSlice = editedBytes.buffer.slice(
        editedBytes.byteOffset,
        editedBytes.byteOffset + editedBytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([bufferSlice], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = documentName.replace(/\.pdf$/i, "") + "-edited.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export PDF: " + String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app-shell">
      <Toolbar
        documentName={documentName}
        pageIndex={pageIndex}
        pageCount={pageCount}
        zoom={zoom}
        canUndo={canUndo}
        canRedo={canRedo}
        theme={theme}
        isExporting={isExporting}
        onOpenFile={handleOpenFile}
        onPrevPage={() => setPageIndex((p) => Math.max(0, p - 1))}
        onNextPage={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
        onZoomIn={() => setZoom((z) => Math.min(3.0, z + 0.15))}
        onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.15))}
        onZoomReset={() => setZoom(1.0)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleTheme={handleToggleTheme}
        onExport={handleExport}
      />

      <div className="workspace">
        <Sidebar
          pdfDoc={pdfDoc}
          pageCount={pageCount}
          currentPage={pageIndex}
          collapsed={sidebarCollapsed}
          onSelectPage={(idx) => setPageIndex(idx)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <PdfViewer
          pdfDoc={pdfDoc}
          pageIndex={pageIndex}
          zoom={zoom}
          textRuns={textRuns}
          onUpdateTextRun={handleUpdateTextRun}
          onActiveRunChange={setActiveRun}
          onDropFile={handleOpenFile}
        />
      </div>

      <StatusBar
        documentName={documentName}
        pageIndex={pageIndex}
        pageCount={pageCount}
        zoom={zoom}
        editsCount={editsMap.size}
        activeRun={activeRun}
      />
    </div>
  );
};
