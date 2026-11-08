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
      {/* Brand & Document Name */}
      <div className="toolbar-left">
        <div className="brand-mark">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="brand-title">fuckpdf</span>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="application/pdf"
          onChange={handleFileChange}
        />

        <button
          className="btn-toolbar"
          onClick={() => fileInputRef.current?.click()}
          title="Open PDF"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Open</span>
        </button>

        {documentName && (
          <div className="document-chip" title={documentName}>
            <span>{documentName}</span>
          </div>
        )}
      </div>

      {/* Center Pagination & Zoom Controls */}
      <div className="toolbar-center">
        {/* Pagination Segment */}
        <div className="segmented-group">
          <button
            className="btn-segment"
            disabled={pageIndex <= 0}
            onClick={onPrevPage}
            title="Previous page"
            aria-label="Previous page"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="segment-label">
            {pageCount > 0 ? `${pageIndex + 1} / ${pageCount}` : "0 / 0"}
          </div>
          <button
            className="btn-segment"
            disabled={pageIndex >= pageCount - 1}
            onClick={onNextPage}
            title="Next page"
            aria-label="Next page"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Zoom Segment */}
        <div className="segmented-group">
          <button
            className="btn-segment"
            onClick={onZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className="btn-segment segment-label-btn"
            onClick={onZoomReset}
            title="Reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="btn-segment"
            onClick={onZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right Actions: Undo, Redo, Theme, Export */}
      <div className="toolbar-right">
        <div className="action-buttons">
          <button
            className="btn-toolbar"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
            <span className="btn-text">Undo</span>
          </button>

          <button
            className="btn-toolbar"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 14 20 9 15 4" />
              <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
            </svg>
            <span className="btn-text">Redo</span>
          </button>
        </div>

        <button
          className="btn-toolbar btn-icon-only"
          onClick={onToggleTheme}
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
        >
          {theme === "dark" ? (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button
          className="btn-primary-action"
          disabled={isExporting || pageCount === 0}
          onClick={onExport}
          title="Download edited PDF"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>{isExporting ? "Exporting..." : "Export PDF"}</span>
        </button>
      </div>
    </header>
  );
};
