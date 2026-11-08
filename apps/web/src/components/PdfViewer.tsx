import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { TextRun } from "@pdf-editor/core";
import { TextOverlay } from "./TextOverlay";

interface PdfViewerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageIndex: number;
  zoom: number;
  textRuns: TextRun[];
  onUpdateTextRun: (runId: string, newText: string, previousText: string) => void;
  onActiveRunChange: (run: TextRun | null) => void;
  onDropFile: (file: File) => void;
  onLoadSample?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfDoc,
  pageIndex,
  zoom,
  textRuns,
  onUpdateTextRun,
  onActiveRunChange,
  onDropFile,
  onLoadSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        <div className="empty-dropzone-container">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onDropFile(file);
              }
              e.target.value = "";
            }}
          />
          <div
            className="empty-upload-card"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="empty-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
            </div>
            <h2 className="empty-title">Select a PDF to edit</h2>
            <p className="empty-subtitle">Drag and drop a PDF file here, or click to browse</p>
            <button
              type="button"
              className="btn-empty-select"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Choose File
            </button>
          </div>

          {onLoadSample && (
            <div className="empty-sample-wrap">
              <button
                type="button"
                className="btn-empty-sample"
                onClick={onLoadSample}
              >
                Or try sample invoice
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
};
