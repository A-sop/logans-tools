import type { ClassificationResult, FileRoutingResult } from '@/lib/dabos-ops/document-intake/types';

export interface MarkdownDocumentInput {
  originalFileName: string;
  finalFileName: string;
  routing: FileRoutingResult;
  classification: ClassificationResult;
  extractedText: string;
  includeFullText: boolean;
  warnings: string[];
}

export function createDocumentMarkdown(input: MarkdownDocumentInput): string {
  const nowIso = new Date().toISOString();
  const warningBlock =
    input.warnings.length > 0
      ? input.warnings.map((warning) => `- ${warning}`).join('\n')
      : '- none';

  const textSection = input.includeFullText
    ? input.extractedText || '[No extracted text]'
    : (input.extractedText || '[No extracted text]').slice(0, 5000);

  return [
    '# Document Summary',
    '',
    `- Processed At: ${nowIso}`,
    `- Original File: ${input.originalFileName}`,
    `- Final File: ${input.finalFileName}`,
    `- Detected Type: ${input.routing.kind}`,
    `- MIME Type: ${input.routing.mimeType}`,
    '',
    '## Classification',
    '',
    `- Document Type: ${input.classification.documentType}`,
    `- Organization: ${input.classification.organization}`,
    `- Relevant Person: ${input.classification.person}`,
    `- Action: ${input.classification.action}`,
    `- Action Required: ${input.classification.actionRequired}`,
    `- Status: ${input.classification.status}`,
    `- Date (YYMMDD): ${input.classification.documentDateYYMMDD}`,
    `- Confidence: ${input.classification.confidence.toFixed(2)}`,
    '',
    '## Summary',
    '',
    input.classification.summary || 'No summary available.',
    '',
    '## Warnings',
    '',
    warningBlock,
    '',
    '## Full Text',
    '',
    '```text',
    textSection,
    '```',
    '',
  ].join('\n');
}
