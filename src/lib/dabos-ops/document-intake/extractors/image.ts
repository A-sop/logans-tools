import type { ExtractionResult } from '@/lib/dabos-ops/document-intake/types';

export async function extractTextFromImage(filePath: string): Promise<ExtractionResult> {
  const tesseractModule = (await import('tesseract.js')) as unknown as {
    createWorker: (
      langs?: string,
      oem?: unknown,
      options?: { logger?: (message: unknown) => void }
    ) => Promise<{
      recognize: (source: string) => Promise<{ data?: { text?: string } }>;
      terminate: () => Promise<void>;
    }>;
  };

  const worker = await tesseractModule.createWorker('eng+deu', undefined, {
    logger: () => {
      return;
    },
  });

  try {
    const result = await worker.recognize(filePath);
    const extractedText = result.data?.text?.trim() ?? '';
    const warnings: string[] = [];
    if (!extractedText) warnings.push('No OCR text extracted from image.');
    return { extractedText, warnings };
  } finally {
    await worker.terminate();
  }
}
