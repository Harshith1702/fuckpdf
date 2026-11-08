import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { TextRun } from "@pdf-editor/core";
import { TextOverlay } from "./TextOverlay.js";

interface PdfViewerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageIndex: number;
  zoom: number;
  textRuns: TextRun[];
  onUpdateTextRun: (runId: string, newText: string, previousText: string) => void;
  onActiveRunChange: (run: TextRun | null) => void;
  onDropFile: (file: File) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfDoc,
  pageIndex,
  zoom,
  textRuns,
  onUpdateTextRun,
  onActiveRunChange,
  onDropFile,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewportDims, setViewportDims] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });
  const [isDragging, setIsDragging] = useState(false);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageIndex + 1);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: zoom });
        setViewportDims({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Support High-DPI screens
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;

        if (isCancelled) return;

      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageIndex, zoom, textRuns]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      onDropFile(file);
    }
  };

  return (
    <main
      className="viewport"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="dropzone-overlay">
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>Drop PDF to open</div>
          <div style={{ color: "var(--text-secondary)" }}>Release file to load into editor</div>
        </div>
      )}

      {pdfDoc ? (
        <div
          className="page-wrapper"
          style={{
            width: `${viewportDims.width}px`,
            height: `${viewportDims.height}px`,
          }}
        >
          <canvas ref={canvasRef} className="pdf-canvas" />
          <TextOverlay
            textRuns={textRuns}
            scale={zoom}
            viewportHeight={viewportDims.height}
            onUpdateTextRun={onUpdateTextRun}
            onActiveRunChange={onActiveRunChange}
          />
        </div>
      ) : (
        <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>No PDF open</p>
          <p style={{ fontSize: "12px" }}>Drag and drop a PDF file here or click &quot;Open PDF&quot; in the toolbar.</p>
        </div>
      )}
    </main>
  );
};
