import { describe, it, expect } from "vitest";
import {
  tokenizeContentStream,
  decodePdfLiteralString,
  encodePdfLiteralString,
  decodePdfHexString,
} from "../src/parser/tokenizer.js";
import { parseTextRuns } from "../src/interpreter/stream-interpreter.js";
import { replaceTextRunInStream } from "../src/edit/stream-editor.js";

describe("Tokenizer", () => {
  it("decodes escaped PDF literal strings properly", () => {
    expect(decodePdfLiteralString("(Hello \\(World\\))")).toBe("Hello (World)");
    expect(decodePdfLiteralString("(Line 1\\nLine 2)")).toBe("Line 1\nLine 2");
    expect(decodePdfLiteralString("(Tab\\tSeparated)")).toBe("Tab\tSeparated");
    expect(decodePdfLiteralString("(Backslash\\\\)")).toBe("Backslash\\");
    expect(decodePdfLiteralString("(Octal \\101\\102)")).toBe("Octal AB");
  });

  it("encodes PDF literal strings escaping special characters", () => {
    expect(encodePdfLiteralString("Hello (World)")).toBe("(Hello \\(World\\))");
    expect(encodePdfLiteralString("Line\nBreak")).toBe("(Line\\nBreak)");
    expect(encodePdfLiteralString("Path\\To\\File")).toBe("(Path\\\\To\\\\File)");
  });

  it("decodes PDF hex strings", () => {
    expect(decodePdfHexString("<48656c6c6f>")).toBe("Hello");
    // Odd number of digits pads with trailing 0
    expect(decodePdfHexString("<4>")).toBe("@"); // 0x40 is '@'
  });

  it("tokenizes operators, numbers, and names", () => {
    const stream = "BT /F1 12.5 Tf 100 200 Td (Hello World) Tj ET";
    const tokens = tokenizeContentStream(stream);

    expect(tokens.map((t) => t.type)).toEqual([
      "operator", // BT
      "name",     // /F1
      "number",   // 12.5
      "operator", // Tf
      "number",   // 100
      "number",   // 200
      "operator", // Td
      "string",   // (Hello World)
      "operator", // Tj
      "operator", // ET
    ]);
  });
});

describe("Stream Interpreter", () => {
  it("extracts text runs with font and size", () => {
    const stream = [
      "BT",
      "/F1 18 Tf",
      "72 700 Td",
      "(First line) Tj",
      "ET",
      "BT",
      "/F2 12 Tf",
      "72 650 Td",
      "[(Second) -50 ( line)] TJ",
      "ET",
    ].join("\n");

    const runs = parseTextRuns(stream);
    expect(runs).toHaveLength(2);

    expect(runs[0].operator).toBe("Tj");
    expect(runs[0].fontName).toBe("F1");
    expect(runs[0].fontSize).toBe(18);
    expect(runs[0].text).toBe("First line");

    expect(runs[1].operator).toBe("TJ");
    expect(runs[1].fontName).toBe("F2");
    expect(runs[1].fontSize).toBe(12);
    expect(runs[1].text).toBe("Second line");
  });
});

describe("Stream Editor", () => {
  it("replaces a target text run cleanly", () => {
    const stream = "BT /F1 18 Tf 72 700 Td (Original String) Tj ET";
    const runs = parseTextRuns(stream);
    expect(runs).toHaveLength(1);

    const edited = replaceTextRunInStream(stream, runs[0], "Updated String");
    expect(edited).toBe("BT /F1 18 Tf 72 700 Td (Updated String) Tj ET");
  });

  it("applies edits across an entire PDF document cleanly", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { applyEditsToPdfBytes } = await import("../src/edit/stream-editor.js");
    const mupdf = await import("mupdf");

    const fixturePath = path.resolve(__dirname, "../../../fixtures/pdfs/simple-word.pdf");
    if (!fs.existsSync(fixturePath)) return;

    const originalBytes = fs.readFileSync(fixturePath);
    const editedBytes = applyEditsToPdfBytes(originalBytes, [
      { pageIndex: 0, originalText: "#1042", newText: "#4567" },
    ]);

    const reopened = mupdf.Document.openDocument(editedBytes, "application/pdf").asPDF();
    const text = reopened.loadPage(0).toStructuredText().asText();
    expect(text).toContain("#4567");
  });

  it("applies full line edits and multiple edits cleanly", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { applyEditsToPdfBytes } = await import("../src/edit/stream-editor.js");
    const mupdf = await import("mupdf");

    const fixturePath = path.resolve(__dirname, "../../../fixtures/pdfs/simple-word.pdf");
    const originalBytes = fs.readFileSync(fixturePath);
    const editedBytes = applyEditsToPdfBytes(originalBytes, [
      {
        pageIndex: 0,
        runIndex: 0,
        originalText: "Invoice #1042 - Total Amount: $500.00",
        newText: "Invoice #9999 - Total Amount: $999.00",
      },
      {
        pageIndex: 0,
        runIndex: 1,
        originalText: "Thank you for your business.",
        newText: "Thank you very much!",
      },
    ]);

    const reopened = mupdf.Document.openDocument(editedBytes, "application/pdf").asPDF();
    const stream = reopened.findPage(0).get("Contents").readStream().asString();
    expect(stream).toContain("Invoice #9999 - Total Amount: $999.00");
    expect(stream).toContain("Thank you very much!");
  });
});
