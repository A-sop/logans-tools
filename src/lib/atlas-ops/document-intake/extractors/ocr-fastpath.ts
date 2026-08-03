import { spawn } from 'child_process';

/**
 * Local "fast path" OCR: PyMuPDF render + Tesseract CLI, driven by
 * scripts/document-intake/ocr/render-and-ocr.py. Far faster than in-process
 * tesseract.js and uses the proven deu-first config. Returns null on any
 * failure (missing Python/PyMuPDF/tesseract, timeout, bad JSON) so the caller
 * can fall back rather than hang an unattended run.
 */
export interface FastPathOcrOptions {
  pythonExe: string;
  scriptPath: string;
  tesseractExe: string;
  tessdataDir: string;
  dpi: number;
  lang: string;
  psm: number;
  timeoutMs: number;
  maxPages?: number;
}

export interface FastPathOcrResult {
  text: string;
  pageCount: number;
  engine: string;
  warnings: string[];
}

interface FastPathJson {
  engine: string;
  page_count: number;
  processed_pages: number;
  pages: Array<{ index: number; text: string }>;
  warnings: string[];
  elapsed_ms: number;
}

export async function runFastPathOcr(
  pdfPath: string,
  options: FastPathOcrOptions
): Promise<FastPathOcrResult | null> {
  const args = [
    options.scriptPath,
    '--pdf',
    pdfPath,
    '--dpi',
    String(options.dpi),
    '--lang',
    options.lang,
    '--psm',
    String(options.psm),
    '--tesseract',
    options.tesseractExe,
  ];
  if (options.tessdataDir) args.push('--tessdata-dir', options.tessdataDir);
  if (options.maxPages && options.maxPages > 0) args.push('--max-pages', String(options.maxPages));

  return new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    const finish = (value: FastPathOcrResult | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process -- local OCR helper; pythonExe/args are operator-configured, not request input
    const child = spawn(options.pythonExe, args, { windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, options.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    // stderr is diagnostic only; the exit code drives success/failure.
    child.stderr.on('data', () => {});
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as FastPathJson;
        const text = parsed.pages
          .map((page) => page.text)
          .filter(Boolean)
          .join('\n\n')
          .trim();
        finish({
          text,
          pageCount: parsed.page_count,
          engine: parsed.engine,
          warnings: parsed.warnings ?? [],
        });
      } catch {
        finish(null);
      }
    });
  });
}
