import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Action it now" from the review UI (Logan 2026-07-12): runs the existing
 * dil:apply pipeline (apply-approved-manifest.ts) server-side. POST
 * {execute:false} = dry-run preview; {execute:true} = real moves/renames.
 * All existing safety stays: frozen-destination guards, move-log, registry
 * updates — this is only a trigger, not a new pipeline.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as { execute?: boolean };
    const args = ['tsx', 'scripts/document-intake/apply-approved-manifest.ts'];
    if (body.execute === true) args.push('--execute');

    const output = await new Promise<{ code: number; text: string }>((resolve) => {
      exec(
        `npx ${args.join(' ')}`,
        { cwd: process.cwd(), timeout: 10 * 60 * 1000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
        (error, stdout, stderr) => {
          const text = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
          resolve({ code: error ? 1 : 0, text });
        },
      );
    });

    const tail = output.text.length > 6000 ? `…\n${output.text.slice(-6000)}` : output.text;
    return NextResponse.json({ ok: output.code === 0, executed: body.execute === true, output: tail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'apply failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
