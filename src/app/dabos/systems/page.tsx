import Link from 'next/link';

export const metadata = {
  title: 'Systems — DABOS',
  description: 'Prompts, sipgate, Comm routing, and other deep tools',
};

const LINKS = [
  {
    href: '/dabos/prompts',
    title: 'Prompts',
    blurb: 'Cursor prompt register mirror (metadata only).',
  },
  {
    href: '/dabos/sipgate',
    title: 'sipgate',
    blurb: 'Assist mailbox — consume or chase events.',
  },
  {
    href: '/dabos/comm',
    title: 'Comm',
    blurb: 'Dept2 routing table — horizontal / command / conference.',
  },
  {
    href: '/dabos/conditions',
    title: 'Conditions',
    blurb: 'Working condition + climb (not primary chrome).',
  },
  {
    href: '/dabos/digest',
    title: 'Status dump',
    blurb: 'Full pull digest including agent text dump.',
  },
] as const;

export default function DabosSystemsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 font-[family-name:var(--font-dabos-body)]">
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-dabos-display)] text-2xl font-semibold tracking-tight text-[color:var(--dabos-on-canvas)]">
          Systems
        </h1>
        <p className="text-sm text-[color:var(--dabos-on-canvas)]/80">
          Deep tools and setup — not the noon pull.
        </p>
      </header>

      <ul className="divide-y divide-border/80 rounded-lg border border-border bg-card">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
            >
              <div className="text-sm font-medium text-foreground">{link.title}</div>
              <div className="mt-0.5 text-xs text-[color:var(--dabos-muted-on-surface)]">
                {link.blurb}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
