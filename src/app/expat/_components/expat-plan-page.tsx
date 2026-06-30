import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Circle, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CREDITS,
  DISCOVERY_THEMES,
  EXPAT_PLAN,
  FUNNEL_STEPS,
  P0_CHECKLIST,
  PAIN_POINTS,
  PREVIEW_SCORES,
  RATES_2026,
  SPRINT_BLOCKS,
  TECH_STACK,
  type SprintStatus,
  type TechStackStatus,
} from '@/data/expat-hackathon-plan';

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

function scoreBarColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

function stackStatusLabel(status: TechStackStatus) {
  if (status === 'live') return 'Live';
  if (status === 'fallback') return 'Fallback';
  return 'Planned';
}

function stackStatusClass(status: TechStackStatus) {
  if (status === 'live') return 'bg-emerald-100 text-emerald-800';
  if (status === 'fallback') return 'bg-muted text-muted-foreground';
  return 'bg-amber-100 text-amber-800';
}

function sprintStatusClass(status: SprintStatus) {
  if (status === 'done') return 'bg-emerald-100 text-emerald-800';
  if (status === 'in_progress') return 'bg-primary/10 text-primary';
  return 'bg-muted text-muted-foreground';
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </a>
  );
}

function ReportMockCard() {
  const overall = Math.round(
    PREVIEW_SCORES.reduce((sum, row) => sum + row.score, 0) / PREVIEW_SCORES.length
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Teaser manual (after submit)
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight">Sample · May 2026</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Full itemised manual — personal walkthrough on call only
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          Live teaser
        </span>
      </div>

      <div className="mt-6 flex items-end gap-2">
        <span className="text-4xl font-bold tabular-nums tracking-tight">{overall}</span>
        <span className="pb-1 text-sm text-muted-foreground">/ 100 illustrative score</span>
      </div>

      <ul className="mt-6 space-y-4">
        {PREVIEW_SCORES.map((row) => (
          <li key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className={cn('font-semibold tabular-nums', scoreColor(row.score))}>
                {row.score}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', scoreBarColor(row.score))}
                style={{ width: `${row.score}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
          </li>
        ))}
      </ul>

      <p className="mt-5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Your call unlocks line items and full numbers. Educational illustration only — not
        financial, tax, or legal advice.
      </p>
    </div>
  );
}

export function ExpatPlanPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-tight">
              {EXPAT_PLAN.productName}
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {EXPAT_PLAN.brandParent} ·{' '}
              <Link href="https://logans.tools" className="hover:text-foreground">
                logans.tools
              </Link>
            </span>
          </div>
          <nav className="hidden items-center gap-5 md:flex">
            <NavLink href="#discovery">Discovery</NavLink>
            <NavLink href="#challenge">Challenge</NavLink>
            <NavLink href="#solution">Solution</NavLink>
            <NavLink href="#sprint">Sprint</NavLink>
            <NavLink href="#stack">Stack</NavLink>
            <NavLink href="#decisions">Decisions</NavLink>
          </nav>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-700">
            MVP live
          </span>
        </div>
      </header>

      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="space-y-6">
            <p className="text-sm font-medium text-primary">{EXPAT_PLAN.tagline}</p>
            <p className="text-xs text-muted-foreground">{EXPAT_PLAN.event}</p>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {EXPAT_PLAN.heroHeadline}
            </h1>
            <p className="max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              {EXPAT_PLAN.heroSubhead}
            </p>
            <p className="max-w-xl text-sm text-muted-foreground">{EXPAT_PLAN.coachLine}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={EXPAT_PLAN.landingUrl} target="_blank" rel="noopener noreferrer">
                  {EXPAT_PLAN.ctaLabel}
                  <ExternalLink className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#sprint">
                  View sprint plan
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <a href="#preview">See teaser mock</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ship target:{' '}
              <strong className="font-medium text-foreground">{EXPAT_PLAN.shipTarget}</strong>
              {' · '}
              Demo: {EXPAT_PLAN.demoTarget}
              {' · '}
              Updated:{' '}
              {new Date(EXPAT_PLAN.lastUpdated).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Europe/Berlin',
              })}{' '}
              CET
            </p>
          </div>
          <div id="preview">
            <ReportMockCard />
          </div>
        </div>
      </section>

      <section id="discovery" className="border-b border-border py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {EXPAT_PLAN.offerTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Answer a few questions about family, income band, and stay intent. We prepare your
            personal numbers for a video call. You see a short teaser after submit; the full manual
            is screen-shared when we meet. Live landing:{' '}
            <a
              href={EXPAT_PLAN.landingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              go.germanfinancialplanning.de/money-manual
            </a>
            .
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {DISCOVERY_THEMES.map((theme) => (
              <article
                key={theme.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold leading-snug">{theme.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{theme.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="challenge" className="border-b border-border py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Three pains the landing page hits before personalisation on the call.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Everything — sales letter, dossier copy, report framing — maps to three core pains.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {PAIN_POINTS.map((pain) => (
              <article
                key={pain.id}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {pain.id}
                </p>
                <h3 className="mt-2 text-base font-semibold leading-snug">{pain.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{pain.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="solution" className="border-b border-border bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            A funnel with teaser now, full manual on the call.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Inspired by structured report products like{' '}
            <a
              href={EXPAT_PLAN.uiReference}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              demo ramp
            </a>
            : clear scores, audit dimensions, and a ranked action list — adapted for expat benefits
            and tax clarity.
          </p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FUNNEL_STEPS.map((item) => (
              <li
                key={item.step}
                className="relative rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <span className="text-xs font-bold tabular-nums text-primary">{item.step}</span>
                <h3 className="mt-2 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                {'route' in item && item.route ? (
                  <a
                    href={`https://${EXPAT_PLAN.productHost}${item.route}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open route
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="sprint" className="border-b border-border py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            One-day sprint — Saturday 30 May
          </h2>
          <p className="mt-3 text-muted-foreground">
            Logan starts ~10:00. Sunday is pitch polish only.
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="p-4 font-medium">Time</th>
                  <th className="p-4 font-medium">Focus</th>
                  <th className="hidden p-4 font-medium sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {SPRINT_BLOCKS.map((block) => (
                  <tr key={block.time} className="border-b border-border last:border-0">
                    <td className="p-4 font-medium tabular-nums text-foreground">{block.time}</td>
                    <td className="p-4 text-muted-foreground">{block.focus}</td>
                    <td className="hidden p-4 sm:table-cell">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          sprintStatusClass(block.status)
                        )}
                      >
                        {block.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-12 text-lg font-semibold">P0 — must demo by Sat 20:00</h3>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {P0_CHECKLIST.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                {item.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="stack" className="border-b border-border bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Tech stack &amp; credits</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            What powers Money Manual and this build log. Updated as tools go live during the hackathon.
          </p>

          <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="p-4 font-medium">Layer</th>
                  <th className="p-4 font-medium">Tools</th>
                  <th className="hidden p-4 font-medium md:table-cell">Role</th>
                  <th className="p-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {TECH_STACK.map((row) => (
                  <tr key={row.layer} className="border-b border-border last:border-0">
                    <td className="p-4 font-medium">{row.layer}</td>
                    <td className="p-4 text-muted-foreground">
                      {'href' in row && row.href ? (
                        <a
                          href={row.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          {row.tools}
                        </a>
                      ) : (
                        row.tools
                      )}
                    </td>
                    <td className="hidden p-4 text-muted-foreground md:table-cell">{row.role}</td>
                    <td className="p-4">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          stackStatusClass(row.status)
                        )}
                      >
                        {stackStatusLabel(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Portfolio-wide tools &amp; referral research:{' '}
            <Link href="/stack" className="font-medium text-primary hover:underline">
              logans.tools/stack
            </Link>
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Team</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {CREDITS.team.map((person) => (
                  <li key={person.name}>
                    <span className="font-medium text-foreground">{person.name}</span>
                    <span className="block text-xs">{person.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Event</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                <a
                  href={CREDITS.event.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {CREDITS.event.name}
                </a>
                <span className="block text-xs mt-1">{CREDITS.event.when}</span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Sponsors &amp; learning</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {CREDITS.sponsors.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {s.name}
                    </a>
                    <span className="block text-xs">{s.note}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Brand</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                <a
                  href={CREDITS.brand.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {CREDITS.brand.name}
                </a>
                <span className="block text-xs mt-1">{EXPAT_PLAN.productName}</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                PRD:{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{EXPAT_PLAN.prdPath}</code>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Product repo:{' '}
                <a
                  href={EXPAT_PLAN.productRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  german-financial-planning
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="decisions" className="border-b border-border py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Locked decisions (§16)</h2>
          <p className="mt-3 text-muted-foreground">
            Calculator constants and boundaries — sourced from German law where applicable.
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="p-4 font-medium">Item</th>
                  <th className="p-4 font-medium">2026 assumption</th>
                  <th className="hidden p-4 font-medium md:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {RATES_2026.map((row) => (
                  <tr key={row.item} className="border-b border-border last:border-0">
                    <td className="p-4 font-medium">{row.item}</td>
                    <td className="p-4 tabular-nums text-muted-foreground">{row.value}</td>
                    <td className="hidden p-4 text-muted-foreground md:table-cell">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">UI reference</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Look-and-feel from{' '}
              <a
                href={EXPAT_PLAN.uiReference}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                demo ramp
                <ExternalLink className="size-3.5" />
              </a>
              : hero + report card, numbered pains, process steps, score dimensions, action
              checklist.
            </p>
          </div>
        </div>
      </section>

      <footer className="py-10">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          <p>
            Work in progress · {EXPAT_PLAN.productName} · {EXPAT_PLAN.brandParent} ·{' '}
            {EXPAT_PLAN.event}
          </p>
          <p className="mt-2">
            <Link href={EXPAT_PLAN.landingUrl} className="text-primary hover:underline">
              {EXPAT_PLAN.landingUrl.replace('https://', '')}
            </Link>
            {' · '}
            <Link href="https://logans.tools" className="text-primary hover:underline">
              logans.tools
            </Link>
            {' · '}
            <Link
              href="https://www.germanfinancialplanning.de"
              className="text-primary hover:underline"
            >
              germanfinancialplanning.de
            </Link>
          </p>
          <p className="mt-4">
            Educational illustration only — not financial, tax, or legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
