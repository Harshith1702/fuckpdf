export interface TextRun {
  id: string;
  runIndex?: number;
  pageIndex: number;
  text: string;
  originalText: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    baselineY: number;
  };
  fontName: string;
  fontFamily?: string;
  fontSize: number;
  isBold?: boolean;
  isItalic?: boolean;
}

export interface PdfPageModel {
  pageIndex: number;
  width: number;
  height: number;
  rotation: number;
  textRuns: TextRun[];
}

export interface DocumentModel {
  name: string;
  pageCount: number;
  pages: PdfPageModel[];
  edits: TextEditOperation[];
}

export interface TextEditOperation {
  type: "text-edit";
  runId: string;
  runIndex?: number;
  pageIndex: number;
  previousText: string;
  newText: string;
  timestamp: number;
}

export interface PageRotateOperation {
  type: "page-rotate";
  pageIndex: number;
  previousRotation: number;
  newRotation: number;
  timestamp: number;
}

export type EditOperation = TextEditOperation | PageRotateOperation;
