import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Cpu, Hammer, Zap } from 'lucide-react';

import { EXPAT_PLAN } from '@/data/expat-hackathon-plan';
import { PORTFOLIO_STACK } from '@/data/portfolio-stack';

/** Core daily-driver tools — full list + referral research at /stack */
const USING = PORTFOLIO_STACK.filter((t) =>
  [
    'Cursor (AI-assisted development)',
    'Wispr Flow (voice input)',
    'Next.js, React, TypeScript',
    'Tailwind CSS, shadcn/ui',
    'Linear (task management)',
    'Vercel (deployment)',
  ].includes(t.label)
);

const OFFBOARDING: string[] = [
  // Add tools you're moving away from
];

/** Latest project — keep this at the top of the homepage. Update when the active build changes. */
const FEATURED = {
  badge: 'Building now',
  event: EXPAT_PLAN.event,
  title: EXPAT_PLAN.productName,
  subtitle: EXPAT_PLAN.tagline,
  description: EXPAT_PLAN.heroSubhead,
  buildLogHref: '/expat',
  screenshotSrc: '/money-manual-landing.png',
  screenshotAlt: `${EXPAT_PLAN.productName} landing — ${EXPAT_PLAN.brandParent}`,
  appHref: EXPAT_PLAN.landingUrl,
  appLabel: 'go.germanfinancialplanning.de/money-manual',
} as const;

export default async function Home() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').toLowerCase();
  if (host.startsWith('euer.')) {
    const c = await cookies();
    const hasPreview = c.get('euer_preview')?.value === '1';
    if (hasPreview) redirect('/euer');
    redirect('/euer-access?next=/euer');
  }

  if (host.startsWith('gabc.')) {
    const c = await cookies();
    const hasPreview = c.get('gabc_preview')?.value === '1';
    if (hasPreview) redirect('/gabc');
    redirect('/gabc-access?next=/gabc');
  }

  if (host.startsWith('expat.')) {
    redirect('/expat');
  }

  if (host.startsWith('dabos.')) {
    redirect('/dabos');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Logans.Tools</h1>
        <p className="text-lg text-muted-foreground">
          I&apos;m a millennial learning vibe coding — building with AI, Cursor, and a mindset
          borrowed from{' '}
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

      <section id="building-now" className="mt-10 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
            <Hammer className="size-3.5" aria-hidden />
            {FEATURED.badge}
          </span>
          <span className="text-xs text-muted-foreground">{FEATURED.event}</span>
        </div>
        <h2 className="text-lg font-semibold">
          {FEATURED.title}
          <span className="mt-1 block text-base font-normal text-muted-foreground">
            {FEATURED.subtitle}
          </span>
        </h2>
        <p className="text-muted-foreground">{FEATURED.description}</p>
        <Link
          href={FEATURED.buildLogHref}
          className="group block rounded-lg border border-primary/30 overflow-hidden shadow-sm transition-colors hover:border-primary/50"
        >
          <Image
            src={FEATURED.screenshotSrc}
            alt={FEATURED.screenshotAlt}
            width={1200}
            height={675}
            className="w-full h-auto transition-opacity group-hover:opacity-95"
            priority
          />
          <span className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3 text-sm font-medium text-primary group-hover:bg-muted/50">
            Open build log — sprint plan &amp; report mock
            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        <p className="text-xs text-muted-foreground">
          Live landing:{' '}
          <Link
            href={FEATURED.appHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {FEATURED.appLabel}
          </Link>
          {' · '}
          Build log:{' '}
          <Link href={FEATURED.buildLogHref} className="font-medium text-primary hover:underline">
            logans.tools/expat
          </Link>
        </p>
      </section>

      <section id="concierge" className="mt-16 space-y-4">
        <h2 className="text-lg font-semibold">Concierge</h2>
        <p className="text-muted-foreground">
          A concierge function for busy executives — clarity, coordination, and getting things done
          so you don&apos;t have to.
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
            Set up Android backup to a local Windows folder that your external HDD schedule already
            includes.
          </p>
          <Link
            href="/android-phone-backup"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open backup guide
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Tools &amp; referral links:{' '}
          <Link href="/stack" className="font-medium text-primary hover:underline">
            full tech stack
          </Link>
        </p>
      </section>

      <section id="how-i-work" className="mt-16 space-y-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cpu className="size-5" />
          How I work
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Using</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {USING.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span className="text-primary">→</span>
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="font-medium text-primary hover:underline"
                    >
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/stack"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Full stack &amp; referral links
              <ArrowRight className="size-4" />
            </Link>
          </div>
          {OFFBOARDING.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Offboarding</h3>
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
          I learn from Pirate Skills — Builder Codex, productised workflows, building in public. You
          can too.
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
