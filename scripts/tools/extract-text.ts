// Dumps plain text from a PDF/DOCX/XLSX file to stdout — used during
// Phase-1 processing (Claude-assisted ingestion, see PROJECT_SPEC.md) to
// read scraped course material. Prefer this over the Read tool's PDF
// rendering for these three formats: this environment doesn't have
// poppler-utils installed, so image-based PDF page rendering isn't
// available, but these are mostly text-heavy academic documents anyway
// (loses embedded images/screenshots — the raw file stays available for
// "open as-is" viewing in the app regardless).
//
// Usage: npx tsx scripts/tools/extract-text.ts <path/to/file>

import { readFile } from "fs/promises";
import path from "path";

async function extractPdf(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const buf = await readFile(filePath);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  return result.text;
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractXlsx(filePath: string): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await readFile(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  let out = "";
  for (const sheetName of wb.SheetNames) {
    out += `\n--- Sheet: ${sheetName} ---\n`;
    const sheet = wb.Sheets[sheetName];
    out += XLSX.utils.sheet_to_csv(sheet);
  }
  return out;
}

async function extractHtml(filePath: string): Promise<string> {
  const { convert } = await import("html-to-text");
  let buf = await readFile(filePath, "utf-8");

  // Some of these (math-heavy practice problems especially) embed the
  // actual content as a base64 data-URI image rather than real text —
  // html-to-text has nothing useful to do with that, so it dumps the
  // raw base64 blob into the output (tens of KB of noise, no content).
  // Strip data-URI images before converting, and say so plainly instead
  // of silently losing the fact that this file's real content wasn't
  // extractable this way at all.
  const imgCount = (buf.match(/<img[^>]*src=["']data:image/gi) || []).length;
  buf = buf.replace(/<img[^>]*src=["']data:image[^"']*["'][^>]*>/gi, "[embedded image — not extracted]");

  const text = convert(buf, { wordwrap: false });
  if (imgCount > 0) {
    return (
      `[NOTE: ${imgCount} embedded image(s) in this file were not extracted as text — ` +
      `likely math/diagrams rendered as images. View them directly if the text below ` +
      `looks incomplete: open the .html file's source, find the data:image URIs, or ` +
      `re-check with the raw file in a browser.]\n\n${text}`
    );
  }
  return text;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx extract-tmp.ts <file>");
    process.exit(1);
  }
  const ext = path.extname(filePath).toLowerCase();
  let text = "";
  if (ext === ".pdf") text = await extractPdf(filePath);
  else if (ext === ".docx") text = await extractDocx(filePath);
  else if (ext === ".xlsx") text = await extractXlsx(filePath);
  else if (ext === ".html" || ext === ".htm") text = await extractHtml(filePath);
  else {
    console.error("Unsupported extension:", ext);
    process.exit(1);
  }
  console.log(text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
