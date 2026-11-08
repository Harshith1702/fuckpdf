import React, { useRef } from "react";

interface ToolbarProps {
  documentName: string;
  pageIndex: number;
  pageCount: number;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  theme: "dark" | "light";
  isExporting: boolean;
  onOpenFile: (file: File) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleTheme: () => void;
  onExport: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  documentName,
  pageIndex,
  pageCount,
  zoom,
  canUndo,
  canRedo,
  theme,
  isExporting,
  onOpenFile,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onUndo,
  onRedo,
  onToggleTheme,
  onExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenFile(file);
    }
  };

  return (
    <header className="toolbar">
      {/* Brand & File Info */}
      <div className="toolbar-group">
        <div className="app-brand">
          PDF EDITOR
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="application/pdf"
          onChange={handleFileChange}
        />
        <button
          className="btn"
          onClick={() => fileInputRef.current?.click()}
          title="Open a PDF file from your computer"
        >
          Open PDF
        </button>

        {documentName && <div className="doc-title" title={documentName}>{documentName}</div>}
      </div>

      {/* Navigation & Zoom */}
      <div className="toolbar-group">
        <button
          className="btn btn-icon"
          disabled={pageIndex <= 0}
          onClick={onPrevPage}
          title="Previous Page"
        >
          &larr;
        </button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", minWidth: "70px", textAlign: "center" }}>
          {pageCount > 0 ? `${pageIndex + 1} / ${pageCount}` : "0 / 0"}
        </span>
        <button
          className="btn btn-icon"
          disabled={pageIndex >= pageCount - 1}
          onClick={onNextPage}
          title="Next Page"
        >
          &rarr;
        </button>

        <div className="divider" />

        <button className="btn btn-icon" onClick={onZoomOut} title="Zoom Out">
          &minus;
        </button>
        <button
          className="btn"
          onClick={onZoomReset}
          title="Reset Zoom to 100%"
          style={{ minWidth: "55px", justifyContent: "center" }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button className="btn btn-icon" onClick={onZoomIn} title="Zoom In">
          &#43;
        </button>
      </div>

      {/* Actions: Undo / Redo / Theme / Export */}
      <div className="toolbar-group">
        <button
          className="btn btn-icon"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
        >
          &#x21A9; Undo
        </button>
        <button
          className="btn btn-icon"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          &#x21AA; Redo
        </button>

        <div className="divider" />

        <button
          className="btn btn-icon"
          onClick={onToggleTheme}
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
        >
          {theme === "dark" ? "LIGHT" : "DARK"}
        </button>

        <button
          className="btn btn-primary"
          disabled={isExporting || pageCount === 0}
          onClick={onExport}
          title="Export modified PDF with native content streams"
        >
          {isExporting ? "Exporting..." : "Export PDF"}
        </button>
      </div>
    </header>
  );
};
