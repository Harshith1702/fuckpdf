import React, { useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";

interface ThumbnailItemProps {
  doc: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
  doc,
  pageNumber,
  isActive,
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderThumbnail() {
      if (!doc || !canvasRef.current) return;
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const defaultViewport = page.getViewport({ scale: 1 });
        const targetWidth = 140;
        const scale = targetWidth / defaultViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        // Handled silently
      }
    }

    renderThumbnail();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  return (
    <div
      className={`thumb-card ${isActive ? "active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={`Page ${pageNumber}`}
    >
      <div className="thumb-preview">
        <canvas ref={canvasRef} />
      </div>
      <div className="thumb-label">{pageNumber}</div>
    </div>
  );
};

interface SidebarProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageCount: number;
  currentPage: number;
  collapsed: boolean;
  onSelectPage: (index: number) => void;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  pdfDoc,
  pageCount,
  currentPage,
  collapsed,
  onSelectPage,
  onToggleCollapse,
}) => {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <span className="sidebar-title">Pages ({pageCount})</span>
        <button
          className="btn-ghost btn-icon-sm"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      <div className="thumbnails-list">
        {Array.from({ length: pageCount }, (_, i) => (
          <ThumbnailItem
            key={i}
            doc={pdfDoc}
            pageNumber={i + 1}
            isActive={currentPage === i}
            onClick={() => onSelectPage(i)}
          />
        ))}
      </div>
    </aside>
  );
};
