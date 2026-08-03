import * as path from 'path';
import type { LearningThresholds, PipelinePaths } from '@/lib/dabos-ops/document-intake/types';

const DEFAULT_ROOT = 'C:\\DATA\\Documents';

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getPipelinePaths(): PipelinePaths {
  const root = readEnv('DOC_INTAKE_ROOT') ?? DEFAULT_ROOT;
  const inbox = readEnv('DOC_INTAKE_INBOX') ?? path.join(root, 'INBOX');
  const processed = readEnv('DOC_INTAKE_PROCESSED') ?? path.join(root, 'PROCESSED');
  const markdown = readEnv('DOC_INTAKE_MARKDOWN') ?? path.join(root, 'MARKDOWN');
  const failed = readEnv('DOC_INTAKE_FAILED') ?? path.join(root, 'FAILED');
  const indexDir = readEnv('DOC_INTAKE_INDEX_DIR') ?? path.join(root, 'INDEX');
  const sqliteDbPath = readEnv('DOC_INTAKE_SQLITE_PATH') ?? path.join(indexDir, 'document-intake.db');

  return {
    root,
    inbox,
    processed,
    markdown,
    failed,
    indexDir,
    sqliteDbPath,
  };
}

export function shouldRunOcrFallback(): boolean {
  const value = readEnv('DOC_INTAKE_USE_OCR');
  if (value == null) return true;
  return value === '1' || value === 'true';
}

/** OCR engine for scanned/corrupt PDFs. Fast path (PyMuPDF + Tesseract CLI) is default. */
export function getOcrEngine(): 'fastpath' | 'tesseractjs' {
  const value = (readEnv('DOC_INTAKE_OCR_ENGINE') ?? 'fastpath').toLowerCase();
  return value === 'tesseractjs' || value === 'js' ? 'tesseractjs' : 'fastpath';
}

export function getOcrRenderDpi(): number {
  const n = Number.parseInt(readEnv('DOC_INTAKE_OCR_DPI') ?? '450', 10);
  return Number.isFinite(n) && n >= 72 && n <= 1200 ? n : 450;
}

export function getOcrLang(): string {
  return readEnv('DOC_INTAKE_OCR_LANG') ?? 'deu+eng';
}

export function getOcrPsm(): number {
  const n = Number.parseInt(readEnv('DOC_INTAKE_OCR_PSM') ?? '4', 10);
  return Number.isFinite(n) && n >= 0 && n <= 13 ? n : 4;
}

/**
 * Partial OCR: cap how many leading pages the fast path rasterizes+OCRs for triage.
 * Default 2 (first 1â€“2 pages) per the Tranche A ruling. 0 = whole document.
 */
export function getOcrMaxPages(): number {
  const n = Number.parseInt(readEnv('DOC_INTAKE_OCR_MAX_PAGES') ?? '2', 10);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

/**
 * Directory containing deu/eng/osd traineddata. The German pack was staged to a
 * user-writable dir (no admin needed) at C:\DATA\10_WORK\_manifests\tessdata and
 * validated via --list-langs (deu+eng+osd), so that is the default. Override with
 * DOC_INTAKE_TESSDATA_DIR / TESSDATA_PREFIX.
 */
const DEFAULT_TESSDATA_DIR = 'C:\\DATA\\10_WORK\\_manifests\\tessdata';

export function getTessdataDir(): string {
  return readEnv('DOC_INTAKE_TESSDATA_DIR') ?? readEnv('TESSDATA_PREFIX') ?? DEFAULT_TESSDATA_DIR;
}

export function getPythonExecutable(): string {
  return readEnv('DOC_INTAKE_PYTHON') ?? 'python';
}

export function getTesseractExecutable(): string {
  return readEnv('DOC_INTAKE_TESSERACT') ?? 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
}

export function getOcrScriptPath(): string {
  return (
    readEnv('DOC_INTAKE_OCR_SCRIPT') ??
    path.join(process.cwd(), 'scripts', 'document-intake', 'ocr', 'render-and-ocr.py')
  );
}

export function getFastPathOcrTimeoutMs(): number {
  const n = Number.parseInt(readEnv('DOC_INTAKE_OCR_TIMEOUT_MS') ?? '900000', 10);
  return Number.isFinite(n) && n > 0 ? n : 900_000;
}

export function markdownTextPolicy(): 'full' | 'excerpt' {
  const value = readEnv('DOC_INTAKE_MARKDOWN_TEXT_POLICY');
  if (!value) return 'full';
  return value.toLowerCase() === 'excerpt' ? 'excerpt' : 'full';
}

export function isLearningEnabled(): boolean {
  const value = readEnv('DOC_INTAKE_LEARNING_ENABLED');
  return value === '1' || value === 'true';
}

export function isAutoPromoteEnabled(): boolean {
  const value = readEnv('DOC_INTAKE_AUTO_PROMOTE_ENABLED');
  return value === '1' || value === 'true';
}

export function learnedRulesVersionOverride(): number | null {
  const value = readEnv('DOC_INTAKE_LEARNED_RULES_VERSION');
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function learningThresholds(): LearningThresholds {
  const support = Number.parseInt(readEnv('DOC_INTAKE_PROMOTE_MIN_SUPPORT') ?? '3', 10);
  const precision = Number.parseFloat(readEnv('DOC_INTAKE_PROMOTE_MIN_PRECISION') ?? '0.85');

  return {
    minSupportCount: Number.isFinite(support) && support > 0 ? support : 3,
    minPrecisionScore: Number.isFinite(precision) && precision > 0 && precision <= 1 ? precision : 0.85,
  };
}

export function learningModelVersion(): string {
  return readEnv('DOC_INTAKE_MODEL_VERSION') ?? 'baseline-v1';
}

export function isLlmInterpreterEnabled(): boolean {
  const value = readEnv('DOC_INTAKE_LLM_ENABLED');
  if (value != null) {
    return value === '1' || value === 'true';
  }
  return hasLlmCredentials();
}

export function hasLlmCredentials(): boolean {
  return Boolean(readEnv('OPENAI_API_KEY') || readEnv('GROQ_API_KEY') || readEnv('LLM_API_BASE'));
}

export interface IntakePreflight {
  ocrEnabled: boolean;
  ocrEngine: 'fastpath' | 'tesseractjs';
  llmEnabled: boolean;
  llmCredentialsPresent: boolean;
  learningEnabled: boolean;
  autoPromoteEnabled: boolean;
  rootPath: string;
}

export function getIntakePreflight(paths: PipelinePaths): IntakePreflight {
  const llmCredentialsPresent = hasLlmCredentials();
  return {
    ocrEnabled: shouldRunOcrFallback(),
    ocrEngine: getOcrEngine(),
    llmEnabled: isLlmInterpreterEnabled(),
    llmCredentialsPresent,
    learningEnabled: isLearningEnabled(),
    autoPromoteEnabled: isAutoPromoteEnabled(),
    rootPath: paths.root,
  };
}
