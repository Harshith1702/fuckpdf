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
      <div className="status-item">
        <span>Doc:</span>
        <span style={{ color: "var(--text-primary)" }}>{documentName || "None"}</span>
        {pageCount > 0 && (
          <>
            <span style={{ margin: "0 4px" }}>|</span>
            <span>Page {pageIndex + 1} of {pageCount}</span>
          </>
        )}
      </div>

      {activeRun && (
        <div className="status-item" style={{ color: "var(--accent)" }}>
          <span>Editing:</span>
          <span>Font: {activeRun.fontName} ({Math.round(activeRun.fontSize)}pt)</span>
        </div>
      )}

      <div className="status-item">
        {editsCount > 0 && (
          <span className="status-badge-edits">{editsCount} edit{editsCount === 1 ? "" : "s"} applied</span>
        )}
        <span style={{ margin: "0 4px" }}>|</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
};
