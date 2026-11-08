import * as mupdf from "mupdf";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "pdfs");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

export function generateSimpleWordPdf(): string {
  const doc = new mupdf.PDFDocument();
  const font = doc.addSimpleFont(new mupdf.Font("Helvetica"));
  const resources = doc.addObject({
    Font: { F1: font },
  });

  const contentStream = [
    "BT",
    "/F1 18 Tf",
    "72 700 Td",
    "(Invoice #1042 - Total Amount: $500.00) Tj",
    "ET",
    "BT",
    "/F1 12 Tf",
    "72 660 Td",
    "(Thank you for your business.) Tj",
    "ET",
    "BT",
    "/F1 12 Tf",
    "72 630 Td",
    "(Due Date: November 30, 2026) Tj",
    "ET",
  ].join("\n");

  const page = doc.addPage([0, 0, 612, 792], 0, resources, contentStream);
  doc.insertPage(-1, page);

  const outputPath = path.join(outputDir, "simple-word.pdf");
  doc.save(outputPath);
  return outputPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const p = generateSimpleWordPdf();
  console.log(`Generated fixture at: ${p}`);
}
