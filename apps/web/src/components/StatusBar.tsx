import React from "react";
import { TextRun } from "@pdf-editor/core";

interface StatusBarProps {
  documentName: string;
  pageIndex: number;
  pageCount: number;
  zoom: number;
  editsCount: number;
  activeRun: TextRun | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  documentName,
  pageIndex,
  pageCount,
  zoom,
  editsCount,
  activeRun,
}) => {
  return (
    <footer className="status-bar">
      <div className="status-group">
        <span className="status-file">{documentName || "No document loaded"}</span>
        {pageCount > 0 && (
          <span className="status-page">
            Page {pageIndex + 1} of {pageCount}
          </span>
        )}
      </div>

      <div className="status-group">
        {activeRun ? (
          <span className="status-info status-active-edit">
            Editing: {activeRun.fontFamily?.split(",")[0]?.replace(/["']/g, "") ?? activeRun.fontName ?? "Text"} · {Math.round(activeRun.fontSize)}pt
          </span>
        ) : editsCount > 0 ? (
          <span className="status-info status-edits-count">
            {editsCount} edit{editsCount === 1 ? "" : "s"} saved to PDF stream
          </span>
        ) : (
          <span className="status-info">Click any line to edit inline</span>
        )}
      </div>

      <div className="status-group">
        <span className="status-zoom">{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
};
