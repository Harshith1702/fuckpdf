import { EditOperation } from "../model/document.js";

export class HistoryManager {
  private undoStack: EditOperation[] = [];
  private redoStack: EditOperation[] = [];
  private maxDepth: number;

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  push(op: EditOperation): void {
    this.undoStack.push(op);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // Clear redo on new action
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): EditOperation | null {
    const op = this.undoStack.pop();
    if (!op) return null;
    this.redoStack.push(op);
    return op;
  }

  redo(): EditOperation | null {
    const op = this.redoStack.pop();
    if (!op) return null;
    this.undoStack.push(op);
    return op;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }
}
