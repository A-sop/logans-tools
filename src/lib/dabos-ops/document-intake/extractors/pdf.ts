import * as fs from 'fs/promises';
import {
  getFastPathOcrTimeoutMs,
  getOcrEngine,
  getOcrLang,
  getOcrMaxPages,
  getOcrPsm,
  getOcrRenderDpi,
  getOcrScriptPath,
  getPythonExecutable,
  getTessdataDir,
  getTesseractExecutable,
} from '@/lib/dabos-ops/document-intake/config';
import {
  isLowInformationPdfText,
  scoreTextQuality,
} from '@/lib/dabos-ops/document-intake/filename-heuristics';
import { runFastPathOcr } from '@/lib/dabos-ops/document-intake/extractors/ocr-fastpath';
import type { ExtractionResult, TextQuality } from '@/lib/dabos-ops/document-intake/types';

const PDF_PARSE_TIMEOUT_MS = 60_000;
const MIN_TEXT_LENGTH_FOR_OCR = 80;

const QUALITY_RANK: Record<TextQuality, number> = { garbage: 0, low: 1, clean: 2 };

function shouldRunOcrFallbackOnText(extractedText: string): boolean {
  return (
    extractedText.length < MIN_TEXT_LENGTH_FOR_OCR ||
    isLowInformationPdfText(extractedText) ||
    // A long-but-corrupt text layer (CID garbage) passes the length/low-info
    // checks yet must still be OCR'd â€” this is the COR1389 failure mode.
    scoreTextQuality(extractedText) === 'garbage'
  );
}

/**
 * Choose the more trustworthy of embedded vs OCR text by *quality*, not length.
 * A long corrupt text layer previously beat good OCR on length alone and got
 * indexed as garbage; grading first prevents that. Ties break on length.
 */
function chooseBetterText(embedded: string, ocr: string): { text: string; ocrUsed: boolean } {
  const embeddedRank = QUALITY_RANK[scoreTextQuality(embedded)];
  const ocrRank = QUALITY_RANK[scoreTextQuality(ocr)];
  if (ocrRank > embeddedRank) return { text: ocr, ocrUsed: true };
  if (ocrRank < embeddedRank) return { text: embedded, ocrUsed: false };
  return ocr.length > embedded.length ? { text: ocr, ocrUsed: true } : { text: embedded, ocrUsed: false };
}

type PdfParseModule = {
  PDFParse?: new (input: { data: Uint8Array }) => {
    getText: () => Promise<{ text?: string; total?: number }>;
    getScreenshot: () => Promise<{ pages?: Array<{ data?: Uint8Array; dataUrl?: string }> }>;
    destroy: () => Promise<void>;
  };
  default?: {
    PDFParse?: new (input: { data: Uint8Array }) => {
      getText: () => Promise<{ text?: string; total?: number }>;
      getScreenshot: () => Promise<{ pages?: Array<{ data?: Uint8Array; dataUrl?: string }> }>;
      destroy: () => Promise<void>;
    };
  };
};

async function runOcrOnPngBuffers(pageBuffers: Uint8Array[]): Promise<string> {
  const tesseractModule = (await import('tesseract.js')) as unknown as {
    createWorker: (
      langs?: string,
      oem?: unknown,
      options?: { logger?: (message: unknown) => void }
    ) => Promise<{
      recognize: (source: Buffer | Uint8Array) => Promise<{ data?: { text?: string } }>;
      terminate: () => Promise<void>;
    }>;
  };

  const worker = await tesseractModule.createWorker('eng+deu', undefined, {
    logger: () => {
      return;
    },
  });

  const ocrChunks: string[] = [];
  try {
    for (const page of pageBuffers) {
      if (!page || page.length < 100) continue;
      const result = await worker.recognize(Buffer.from(page));
      const text = result.data?.text?.trim();
      if (text) ocrChunks.push(text);
    }
  } finally {
    await worker.terminate();
  }

  return ocrChunks.join('\n\n');
}

export async function extractTextFromPdf(
  filePath: string,
  useOcrFallback: boolean
): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const buffer = await fs.readFile(filePath);

  const pdfParseModule = (await import('pdf-parse')) as PdfParseModule;
  const PDFParseClass = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse;
  if (!PDFParseClass) {
    throw new Error('pdf-parse did not expose PDFParse class.');
  }

  const parser = new PDFParseClass({ data: new Uint8Array(buffer) });
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('PDF parse timeout')), PDF_PARSE_TIMEOUT_MS);
  });

  let extractedText = '';
  let pageCount = 0;
  let ocrUsed = false;

  try {
    const parsed = await Promise.race([parser.getText(), timeout]);
    extractedText = parsed.text?.trim() ?? '';
    pageCount = parsed.total ?? 0;

    if (useOcrFallback && shouldRunOcrFallbackOnText(extractedText) && pageCount > 0) {
      let ocrText = '';

      // Preferred: local PyMuPDF render + Tesseract CLI (deu-first, ~450 dpi).
      // Returns null if Python/PyMuPDF/tesseract are unavailable so we degrade.
      if (getOcrEngine() === 'fastpath') {
        const fast = await runFastPathOcr(filePath, {
          pythonExe: getPythonExecutable(),
          scriptPath: getOcrScriptPath(),
          tesseractExe: getTesseractExecutable(),
          tessdataDir: getTessdataDir(),
          dpi: getOcrRenderDpi(),
          lang: getOcrLang(),
          psm: getOcrPsm(),
          timeoutMs: getFastPathOcrTimeoutMs(),
          maxPages: getOcrMaxPages(),
        });
        if (fast && fast.text) {
          ocrText = fast.text;
        } else {
          warnings.push('OCR fast path unavailable; used in-process OCR fallback.');
        }
      }

      // Fallback: in-process tesseract.js on pdf-parse screenshots.
      if (!ocrText) {
        try {
          const screenshots = await parser.getScreenshot();
          const pageBuffers = (screenshots.pages ?? [])
            .map((page) => page.data)
            .filter((page): page is Uint8Array => Boolean(page));
          if (pageBuffers.length > 0) {
            ocrText = await runOcrOnPngBuffers(pageBuffers);
          }
        } catch {
          warnings.push('OCR fallback failed; continuing with embedded PDF text only.');
        }
      }

      if (ocrText) {
        const choice = chooseBetterText(extractedText, ocrText);
        extractedText = choice.text;
        ocrUsed = choice.ocrUsed;
        if (ocrUsed) {
          warnings.push('Used OCR fallback because embedded PDF text was sparse or corrupt.');
        }
      }
    }
  } finally {
    await parser.destroy().catch(() => {});
  }

  const textQuality = scoreTextQuality(extractedText);

  if (!extractedText) {
    warnings.push('No text extracted from PDF.');
  } else if (textQuality === 'garbage') {
    // Delete-safety gate: a garbage grade must never be treated as a trustworthy
    // transcript. The warning routes the doc to review_required so the original
    // is never eligible for extract-then-delete on bad text.
    warnings.push('Extracted text failed quality check (likely corrupt text layer); flagged for review.');
  }

  return {
    extractedText,
    warnings,
    pageCount,
    textQuality,
    ocrUsed,
  };
}
