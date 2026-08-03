import mammoth from "mammoth";
// Must be imported before "pdf-parse" so its worker resolves correctly on
// serverless platforms like Vercel (see pdf-parse's troubleshooting docs).
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export const MAX_PAGES = 50;
/** Rough character budget; long documents get a pre-summarisation pass before analysis. */
export const LONG_DOCUMENT_THRESHOLD = 80_000;

export interface ParsedDocument {
  text: string;
  truncated: boolean;
  pageCount?: number;
}

export class DocumentParseError extends Error {}

export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    return parsePdf(buffer);
  }
  if (name.endsWith(".docx")) {
    return parseDocx(buffer);
  }
  if (name.endsWith(".txt")) {
    return { text: buffer.toString("utf-8"), truncated: false };
  }

  throw new DocumentParseError(
    "Unsupported file type. Please upload a PDF, .docx, or .txt file, or paste text instead."
  );
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const totalPages = result.total;
    let truncated = false;
    let text = result.text;

    if (totalPages > MAX_PAGES) {
      truncated = true;
      text = result.pages
        .slice(0, MAX_PAGES)
        .map((p) => p.text)
        .join("\n\n");
    }

    if (!text || !text.trim()) {
      throw new DocumentParseError(
        "We couldn't extract any text from this PDF. It may be a scanned image — try pasting the text instead."
      );
    }

    return { text, truncated, pageCount: totalPages };
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  if (!result.value || !result.value.trim()) {
    throw new DocumentParseError(
      "We couldn't extract any text from this .docx file. Please check the file or try pasting the text instead."
    );
  }
  return { text: result.value, truncated: false };
}
