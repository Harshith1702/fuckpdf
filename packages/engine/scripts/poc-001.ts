import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as mupdf from "mupdf";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { parseTextRuns } from "../src/interpreter/stream-interpreter.js";
import { replaceTextRunInStream } from "../src/edit/stream-editor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");
const fixturePath = path.join(rootDir, "fixtures/pdfs/simple-word.pdf");
const outDir = path.join(rootDir, "out");

async function runPoc001() {
  console.log("=== POC-001: Native PDF Text Edit ===");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found at: ${fixturePath}`);
  }

  // 1. Load the PDF with MuPDF WASM
  const fileBytes = fs.readFileSync(fixturePath);
  const doc = mupdf.Document.openDocument(fileBytes, "application/pdf").asPDF();
  if (!doc) {
    throw new Error("Failed to load PDF document with MuPDF");
  }

  console.log(`Loaded ${fixturePath} (${doc.countPages()} page)`);

  // Render before.png
  const page0 = doc.loadPage(0);
  const beforePixmap = page0.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false);
  const beforePngBuffer = Buffer.from(beforePixmap.asPNG());
  const beforePngPath = path.join(outDir, "before.png");
  fs.writeFileSync(beforePngPath, beforePngBuffer);
  console.log(`Rendered before image to: ${beforePngPath}`);

  // 2. Read page 1 content stream bytes
  const pageObj = doc.findPage(0);
  const contentsObj = pageObj.get("Contents");
  if (!contentsObj || !contentsObj.isStream()) {
    throw new Error("Page Contents is not a stream");
  }

  const streamBuffer = contentsObj.readStream();
  const streamString = streamBuffer.asString();
  console.log("\nOriginal content stream:");
  console.log(streamString);

  // 3. Tokenize and find the first text run
  const textRuns = parseTextRuns(streamString);
  if (textRuns.length === 0) {
    throw new Error("No text runs found in page content stream");
  }

  const targetRun = textRuns[0];
  console.log("\nFound target text run:");
  console.log(`  Operator:    ${targetRun.operator}`);
  console.log(`  Byte Range:  [${targetRun.startOffset}, ${targetRun.endOffset}]`);
  console.log(`  Font Name:   ${targetRun.fontName ?? "Unknown"}`);
  console.log(`  Font Size:   ${targetRun.fontSize ?? "Unknown"}`);
  console.log(`  Text:        "${targetRun.text}"`);

  // 4. Replace string operand with new text
  // Replace invoice number with new value of similar length
  const originalText = targetRun.text;
  const newText = originalText.replace("#1042", "#9999");
  console.log(`\nReplacing "${originalText}" -> "${newText}"`);

  const updatedStream = replaceTextRunInStream(streamString, targetRun, newText);
  console.log("\nUpdated content stream:");
  console.log(updatedStream);

  // 5. Write new content stream, update page, serialize PDF
  const mupdfBuf = new mupdf.Buffer();
  mupdfBuf.write(updatedStream);
  contentsObj.writeStream(mupdfBuf);

  const editedPdfPath = path.join(outDir, "edited.pdf");
  doc.save(editedPdfPath);
  console.log(`\nSaved edited PDF to: ${editedPdfPath}`);

  // 6. Render after.png with MuPDF from the saved PDF
  const editedBytes = fs.readFileSync(editedPdfPath);
  const editedDoc = mupdf.Document.openDocument(editedBytes, "application/pdf").asPDF();
  if (!editedDoc) {
    throw new Error("Failed to reopen edited PDF");
  }
  const editedPage0 = editedDoc.loadPage(0);
  const afterPixmap = editedPage0.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false);
  const afterPngBuffer = Buffer.from(afterPixmap.asPNG());
  const afterPngPath = path.join(outDir, "after.png");
  fs.writeFileSync(afterPngPath, afterPngBuffer);
  console.log(`Rendered after image to: ${afterPngPath}`);

  // 7. Verify text in edited PDF via structured text extraction
  const extractedText = editedPage0.toStructuredText().asText();
  console.log("\nExtracted text from edited PDF:\n" + extractedText.trim());
  if (!extractedText.includes("#9999")) {
    throw new Error("Edited PDF does not contain the replacement text in structured text!");
  }

  // 8. Pixel diff between before.png and after.png
  const beforePng = PNG.sync.read(beforePngBuffer);
  const afterPng = PNG.sync.read(afterPngBuffer);
  const { width, height } = beforePng;
  const diffPng = new PNG({ width, height });

  const numDiffPixels = pixelmatch(
    beforePng.data,
    afterPng.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const diffRatio = numDiffPixels / totalPixels;
  const diffPercent = diffRatio * 100;

  const diffPngPath = path.join(outDir, "diff.png");
  fs.writeFileSync(diffPngPath, PNG.sync.write(diffPng));

  console.log(`\nPixel Diff Results:`);
  console.log(`  Total pixels:        ${totalPixels}`);
  console.log(`  Differing pixels:    ${numDiffPixels}`);
  console.log(`  Difference ratio:    ${diffPercent.toFixed(4)}%`);
  console.log(`  Diff image saved to: ${diffPngPath}`);

  if (numDiffPixels === 0) {
    throw new Error("Expected pixels to differ between before and after renders, but diff was 0!");
  }

  // Acceptance criteria: diff tolerance 0.1%
  if (diffPercent > 0.1) {
    throw new Error(
      `Difference ${diffPercent.toFixed(4)}% exceeds 0.1% tolerance! Unexpected page changes.`
    );
  }

  console.log("\n[PASS] POC-001 acceptance criteria satisfied!");
}

runPoc001().catch((err) => {
  console.error("POC-001 failed:", err);
  process.exit(1);
});
