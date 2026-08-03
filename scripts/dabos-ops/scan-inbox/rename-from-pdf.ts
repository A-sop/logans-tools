#!/usr/bin/env npx tsx
/**
 * Scan-inbox renamer: read PDFs, interpret content, rename to
 * YYMMDD_ORGANISATION-SUBJECT_ClientLastname-ClientFirstname_STATUS.pdf
 *
 * Default folder: C:\LDW_Scan (override with first arg).
 * Usage: npx tsx scripts/scan-inbox/rename-from-pdf.ts [<folder>] [--apply]
 *
 * API (optional): OPENAI_API_KEY, or GROQ_API_KEY, or LLM_API_BASE + LLM_API_KEY.
 * Cost is tracked and printed; set SCAN_INBOX_COST_LOG to append a CSV log.
 *
 * OCR: Set SCAN_INBOX_USE_OCR=1 to run Tesseract OCR when the PDF has little or no
 * embedded text (e.g. scanned documents). Slower but unlocks image-only PDFs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DEFAULT_FOLDER = 'C:\\LDW_Scan';

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
}

// Approximate USD per 1M tokens (input, output). Update as needed.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
};

function estimateCost(usage: TokenUsage): number {
  const p = MODEL_PRICING[usage.model];
  if (!p) return 0;
  return (
    (usage.prompt_tokens / 1_000_000) * p.input +
    (usage.completion_tokens / 1_000_000) * p.output
  );
}

const PDF_PARSE_TIMEOUT_MS = 60_000;
const MIN_TEXT_LENGTH_FOR_OCR = 80; // below this we treat as scan and optionally run OCR

// Lazy-load pdf-parse v2 and optionally tesseract.js for OCR
function loadPdfParse(): (buffer: Buffer) => Promise<{ text: string; numpages: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('pdf-parse');
  const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
  if (!PDFParse) {
    throw new Error('pdf-parse: expected PDFParse class (v2). Check package version.');
  }
  const useOcr = process.env.SCAN_INBOX_USE_OCR === '1' || process.env.SCAN_INBOX_USE_OCR === 'true';

  return async (buffer: Buffer) => {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF parse timeout')), PDF_PARSE_TIMEOUT_MS)
    );
    try {
      const result = await Promise.race([parser.getText(), timeout]);
      let text = (result as { text: string }).text ?? '';
      const numpages = (result as { total: number }).total ?? 0;

      if (useOcr && text.trim().length < MIN_TEXT_LENGTH_FOR_OCR && numpages > 0) {
        try {
          const screenshotResult = await parser.getScreenshot();
          const pages = (screenshotResult as { pages: Array<{ data?: Uint8Array; dataUrl?: string }> }).pages ?? [];
          await parser.destroy().catch(() => {});
          if (pages.length > 0) {
            const ocrText = await runOcrOnPages(pages);
            if (ocrText.length > text.length) text = ocrText;
          }
        } catch (ocrErr) {
          await parser.destroy().catch(() => {});
          console.error('OCR failed (continuing with embedded text):', ocrErr);
        }
        return { text: text || '', numpages };
      }

      await parser.destroy().catch(() => {});
      return { text: text || '', numpages };
    } catch (e) {
      await parser.destroy().catch(() => {});
      throw e;
    }
  };
}

async function runOcrOnPages(
  pages: Array<{ data?: Uint8Array; dataUrl?: string }>
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng+deu', undefined, { logger: () => {} });
  const parts: string[] = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const buf = page.data ? Buffer.from(page.data) : null;
      if (!buf || buf.length < 100) continue;
      const { data } = await worker.recognize(buf);
      if (data?.text?.trim()) parts.push(data.text.trim());
    }
  } finally {
    await worker.terminate();
  }
  return parts.join('\n\n');
}

const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function sanitizeSegment(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, '-')
    .replace(INVALID_CHARS, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function buildFilename(parts: {
  date: string; // YYMMDD
  organisationSubject: string;
  clientLastname: string;
  clientFirstname: string;
  status: string;
}): string {
  const orgSubj = sanitizeSegment(parts.organisationSubject);
  const last = sanitizeSegment(parts.clientLastname);
  const first = sanitizeSegment(parts.clientFirstname);
  const status = sanitizeSegment(parts.status);
  const client = [last, first].filter(Boolean).join('-') || 'unknown';
  return `${parts.date}_${orgSubj}_${client}_${status}.pdf`;
}

interface ParsedFields {
  date: string; // YYMMDD
  organisationSubject: string;
  clientLastname: string;
  clientFirstname: string;
  status: string;
}

interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function getLLMConfig(): LLMConfig | null {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: groqKey,
      model: process.env.LLM_MODEL || 'llama-3.1-8b-instant',
    };
  }
  const base = process.env.LLM_API_BASE;
  if (base) {
    const key = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
    return {
      baseUrl: base.replace(/\/$/, ''),
      apiKey: key,
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: openaiKey,
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
    };
  }
  return null;
}

async function interpretWithLLM(
  text: string,
  config: LLMConfig
): Promise<{ fields: ParsedFields; usage?: TokenUsage }> {
  const truncated = text.slice(0, 12000);
  const url = `${config.baseUrl}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `You extract structured fields from a German or English document (e.g. letter, form, scan) for file naming.
Return ONLY valid JSON with these exact keys (no markdown, no explanation):
- date: YYMMDD (document date if found, else today in YYMMDD)
- organisationSubject: organisation code, optionally with subject after hyphen. Use: GEDL (Lebensversicherung), GEDV (Versicherung), GEDK (Krankenversicherung), ADVOCARD, or e.g. GEDL-Beratung, GEDV-Schaden
- clientLastname: for individuals use capitalised last name, no spaces/hyphens within it (e.g. AkbariRad, HansJuergen; hyphenated lastnames like Parker-Bowles become ParkerBowles); for Privatkunden use PK, for Firmenkunden use FK
- clientFirstname: first name (capitalised) or empty for PK/FK. Format is Lastname-Firstname so lastname comes first
- status: one of (lowercase): berechnet, unterschrieben, eingereicht, policiert, info, archiviert, offen`,
        },
        {
          role: 'user',
          content: `Document text:\n\n${truncated}`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in LLM response');
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const defaultDate = `${yy}${mm}${dd}`;
  let date = typeof parsed.date === 'string' ? parsed.date.replace(/\D/g, '') : '';
  if (date.length === 8) date = date.slice(2, 8); // YYYYMMDD -> YYMMDD
  if (date.length !== 6) date = defaultDate;
  const fields: ParsedFields = {
    date,
    organisationSubject:
      typeof parsed.organisationSubject === 'string' ? parsed.organisationSubject : 'unknown',
    clientLastname: typeof parsed.clientLastname === 'string' ? parsed.clientLastname : '',
    clientFirstname: typeof parsed.clientFirstname === 'string' ? parsed.clientFirstname : '',
    status: typeof parsed.status === 'string' ? parsed.status : 'draft',
  };
  const usage: TokenUsage | undefined =
    data.usage?.prompt_tokens != null && data.usage?.completion_tokens != null
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          model: config.model,
        }
      : undefined;
  return { fields, usage };
}

async function getFieldsManual(
  _text: string,
  fileDate: string,
  rl: readline.Interface
): Promise<ParsedFields> {
  const defaults = {
    organisationSubject: 'unknown',
    clientLastname: '',
    clientFirstname: '',
    status: 'draft',
  };
  const ask = (q: string, def: string) =>
    new Promise<string>((resolve) => {
      try {
        rl.question(`${q} [${def}]: `, (a) => resolve((a || def).trim()));
      } catch {
        resolve(def.trim());
      }
    });
  const organisationSubject = await ask('Organisation-Subject', defaults.organisationSubject);
  const clientLastname = await ask('Client last name', defaults.clientLastname);
  const clientFirstname = await ask('Client first name', defaults.clientFirstname);
  const status = await ask('Status (draft/final/signed)', defaults.status);
  return {
    date: fileDate,
    organisationSubject,
    clientLastname,
    clientFirstname,
    status,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const folderArg = args.find((a) => !a.startsWith('--'));
  const folder = folderArg || DEFAULT_FOLDER;
  const apply = args.includes('--apply');
  if (!fs.existsSync(folder)) {
    console.error('Folder not found:', folder);
    console.error('Usage: npx tsx scripts/scan-inbox/rename-from-pdf.ts [<folder>] [--apply]');
    console.error('Default folder:', DEFAULT_FOLDER);
    process.exit(1);
  }
  const pdfFiles = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    console.log('No PDF files in', folder);
    return;
  }
  const llmConfig = getLLMConfig();
  const pdfParse = loadPdfParse();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const usageLog: TokenUsage[] = [];

  for (const file of pdfFiles) {
    const fullPath = path.join(folder, file);
    const stat = fs.statSync(fullPath);
    const mtime = stat.mtime;
    const fileDate =
      String(mtime.getFullYear()).slice(-2) +
      String(mtime.getMonth() + 1).padStart(2, '0') +
      String(mtime.getDate()).padStart(2, '0');
    let fields: ParsedFields;
    try {
      const buffer = fs.readFileSync(fullPath);
      const { text } = await pdfParse(buffer);
      if (llmConfig && text.trim()) {
        const result = await interpretWithLLM(text, llmConfig);
        fields = result.fields;
        if (result.usage) usageLog.push(result.usage);
      } else {
        console.log('\n---', file, '---');
        fields = await getFieldsManual(text, fileDate, rl);
      }
    } catch (err) {
      console.error('Error reading', file, err);
      continue;
    }
    const newName = buildFilename(fields);
    if (newName === file) {
      console.log('(unchanged)', file);
      continue;
    }
    console.log(file, '->', newName);
    if (apply) {
      const newPath = path.join(folder, newName);
      if (fs.existsSync(newPath)) {
        console.error('Skip (target exists):', newPath);
      } else {
        fs.renameSync(fullPath, newPath);
        console.log('Renamed.');
      }
    }
  }

  // Cost summary
  if (usageLog.length > 0) {
    const totalPrompt = usageLog.reduce((s, u) => s + u.prompt_tokens, 0);
    const totalCompletion = usageLog.reduce((s, u) => s + u.completion_tokens, 0);
    const totalCost = usageLog.reduce((s, u) => s + estimateCost(u), 0);
    const model = usageLog[0]?.model ?? 'unknown';
    console.log('\n--- API usage ---');
    console.log(`Model: ${model}`);
    console.log(`Tokens: ${totalPrompt} prompt, ${totalCompletion} completion`);
    console.log(`Estimated cost: $${totalCost.toFixed(4)} USD`);
    const costLogPath = process.env.SCAN_INBOX_COST_LOG;
    if (costLogPath) {
      const line = [
        new Date().toISOString(),
        folder,
        String(usageLog.length),
        model,
        String(totalPrompt),
        String(totalCompletion),
        totalCost.toFixed(4),
      ].join(',');
      const header =
        'date_iso,folder,files_count,model,prompt_tokens,completion_tokens,estimated_usd';
      const exists = fs.existsSync(costLogPath);
      fs.appendFileSync(costLogPath, (exists ? '' : header + '\n') + line + '\n');
      console.log('Appended to', costLogPath);
    }
  }

  if (!apply && pdfFiles.length > 0) {
    console.log('\nDry run. Add --apply to rename files.');
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
