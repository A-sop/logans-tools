import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Cpu, Zap } from 'lucide-react';

const USING = [
  'Cursor + AI-assisted development',
  'Next.js, React, TypeScript',
  'Tailwind CSS, shadcn/ui',
  'Linear for task management',
  'Vercel for deployment',
];

const OFFBOARDING: string[] = [
  // Add tools you're moving away from
];

export default function Home() {
export default async function Home() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').toLowerCase();
  if (host.startsWith('gabc.')) {
    const c = await cookies();
    const hasPreview = c.get('gabc_preview')?.value === '1';
    if (hasPreview) redirect('/gabc');
    redirect('/gabc-access?next=/gabc');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Logans.Tools
        </h1>
        <p className="text-lg text-muted-foreground">
          I&apos;m a millennial learning vibe coding — building with AI, Cursor,
          and a mindset borrowed from{' '}
          <Link
            href="https://pirateskills.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Pirate Skills
          </Link>
          . You can too.
        </p>
      </section>

      <section id="concierge" className="mt-16 space-y-4">
        <h2 className="text-lg font-semibold">Concierge</h2>
        <p className="text-muted-foreground">
          A concierge function for busy executives — clarity, coordination, and
          getting things done so you don&apos;t have to.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          <Image
            src="/cm-landing.png"
            alt="Concierge landing page"
            width={1200}
            height={675}
            className="w-full h-auto"
          />
        </div>
      </section>

      <section id="public-tools" className="mt-16 space-y-4">
        <h2 className="text-lg font-semibold">Public tools</h2>
        <p className="text-muted-foreground">
          Practical guides and workflows you can use directly.
        </p>
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-foreground">
            Android phone backup (USB + LAN)
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up Android backup to a local Windows folder that your external
            HDD schedule already includes.
          </p>
          <Link
            href="/android-phone-backup"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open backup guide
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section id="how-i-work" className="mt-16 space-y-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cpu className="size-5" />
          How I work
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">
              Using
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {USING.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="text-primary">→</span> {t}
                </li>
              ))}
            </ul>
          </div>
          {OFFBOARDING.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                Offboarding
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {OFFBOARDING.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="text-muted-foreground/70">–</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="mt-16 rounded-lg border border-primary/30 bg-primary/5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Zap className="size-5" />
          Pirate Skills
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          I learn from Pirate Skills — Builder Codex, productised workflows,
          building in public. You can too.
        </p>
        <Link
          href="https://pirateskills.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          pirateskills.com
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
