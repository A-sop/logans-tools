import Link from 'next/link';
import { ArrowRight, Wrench, Cpu, ExternalLink } from 'lucide-react';

const PROJECTS = [
  {
    name: 'loganwilliams.com',
    desc: 'Personal site — insights, work with me, life in Germany.',
    href: 'https://loganwilliams.com',
  },
  {
    name: 'German Financial Planning',
    desc: 'Regulated financial planning for expats (GFP).',
    href: 'https://germanfinancialplanning.de',
  },
  {
    name: 'Consulting & More',
    desc: 'Concierge / my-app — Reza&apos;s business.',
    href: '#',
  },
];

const TOOLS = [
  'Cursor + AI-assisted development',
  'Next.js, React, TypeScript',
  'Tailwind CSS, shadcn/ui',
  'Linear for task management',
  'Vercel for deployment',
];

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Logan&apos;s tools & projects hub
        </h1>
        <p className="text-lg text-muted-foreground">
          Overview of projects, how I work, and the tools I use.
        </p>
      </section>

      <section id="projects" className="mt-16 space-y-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="size-5" />
          Projects
        </h2>
        <div className="space-y-4">
          {PROJECTS.map((p) => (
            <div
              key={p.name}
              className="rounded-lg border border-border bg-card p-4"
            >
              <Link
                href={p.href}
                className="group flex items-center justify-between gap-2 font-medium text-foreground"
              >
                {p.name}
                {p.href !== '#' && (
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                )}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-i-work" className="mt-16 space-y-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cpu className="size-5" />
          How I work
        </h2>
        <p className="text-muted-foreground">
          Stack, process, and AI tools I use to build and ship.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {TOOLS.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="text-primary">→</span> {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 rounded-lg border border-primary/30 bg-primary/5 p-6">
        <h2 className="text-lg font-semibold">Pirate Skills</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Inspired by Ben&apos;s work at Pirate Skills — Builder Codex, productised
          workflows, and building in public.
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
