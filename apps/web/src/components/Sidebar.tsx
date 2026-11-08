import React from "react";

interface SidebarProps {
  pageCount: number;
  currentPage: number;
  collapsed: boolean;
  onSelectPage: (index: number) => void;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  pageCount,
  currentPage,
  collapsed,
  onSelectPage,
  onToggleCollapse,
}) => {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <span>Pages ({pageCount})</span>
        <button
          className="btn btn-icon"
          onClick={onToggleCollapse}
          title="Toggle Sidebar"
          style={{ padding: "2px 6px", fontSize: "10px" }}
        >
          {collapsed ? "&gt;" : "&lt;"}
        </button>
      </div>

      <div className="thumbnails-list">
        {Array.from({ length: pageCount }, (_, i) => (
          <div
            key={i}
            className={`thumb-card ${currentPage === i ? "active" : ""}`}
            onClick={() => onSelectPage(i)}
            title={`Go to page ${i + 1}`}
          >
            <div className="thumb-preview">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--text-muted)" }}>
                P.{i + 1}
              </span>
            </div>
            <div className="thumb-label">Page {i + 1}</div>
          </div>
        ))}
      </div>
    </aside>
  );
};
