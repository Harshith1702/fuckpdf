import React, { useState, useRef, useEffect } from "react";
import { TextRun } from "@pdf-editor/core";

interface TextOverlayProps {
  textRuns: TextRun[];
  scale: number;
  viewportHeight: number;
  onUpdateTextRun: (runId: string, newText: string, previousText: string) => void;
  onActiveRunChange?: (run: TextRun | null) => void;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  textRuns,
  scale,
  onUpdateTextRun,
  onActiveRunChange,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempText, setTempText] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommittingRef = useRef(false);

  const activeRun = textRuns.find((r) => r.id === editingId) ?? null;

  useEffect(() => {
    onActiveRunChange?.(activeRun);
  }, [activeRun, onActiveRunChange]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = (run: TextRun) => {
    setEditingId(run.id);
    setTempText(run.text);
  };

  const handleCommitEdit = (run: TextRun) => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    try {
      if (tempText !== run.text) {
        onUpdateTextRun(run.id, tempText, run.text);
      }
      setEditingId(null);
    } finally {
      setTimeout(() => {
        isCommittingRef.current = false;
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, run: TextRun) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitEdit(run);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
    }
  };

  return (
    <div className="text-overlay">
      {textRuns.map((run) => {
        const isEditing = editingId === run.id;
        const isEdited = run.text !== run.originalText;
        const { x, y, width, height } = run.bounds;
        const calculatedWidth = Math.max(
          width,
          run.text.length * (run.fontSize * scale * 0.58) + 12
        );

        if (isEditing) {
          const inputWidth = Math.max(
            width,
            tempText.length * (run.fontSize * scale * 0.58) + 16
          );

          return (
            <input
              key={run.id}
              ref={inputRef}
              className="word-inline-input"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                minWidth: `${Math.max(width, 24)}px`,
                width: `${inputWidth}px`,
                height: `${height}px`,
                fontSize: `${run.fontSize * scale}px`,
                fontFamily: run.fontFamily || "inherit",
                fontWeight: run.isBold ? "bold" : "normal",
                fontStyle: run.isItalic ? "italic" : "normal",
              }}
              value={tempText}
              onChange={(e) => setTempText(e.target.value)}
              onBlur={() => handleCommitEdit(run)}
              onKeyDown={(e) => handleKeyDown(e, run)}
            />
          );
        }

        return (
          <div
            key={run.id}
            className={`word-text-line ${isEdited ? "word-text-line-edited" : ""}`}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${isEdited ? calculatedWidth : Math.max(width, 12)}px`,
              height: `${height}px`,
              fontSize: `${run.fontSize * scale}px`,
              fontFamily: run.fontFamily || "inherit",
              fontWeight: run.isBold ? "bold" : "normal",
              fontStyle: run.isItalic ? "italic" : "normal",
              lineHeight: `${height}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(run);
            }}
          >
            {isEdited ? run.text : null}
          </div>
        );
      })}
    </div>
  );
};
