import type { Metadata } from 'next';
import Link from 'next/link';
import { PORTFOLIO_STACK, type ReferralStatus } from '@/data/portfolio-stack';

const pageDescription =
  'Tools I use to build and ship — with referral links where I have them and notes on programs worth applying to.';

export const metadata: Metadata = {
  title: 'Tech stack',
  description: pageDescription,
};

function referralLabel(status: ReferralStatus | undefined): string {
  switch (status) {
    case 'active':
      return 'Referral live';
    case 'apply':
      return 'Apply for link';
    case 'rewards':
      return 'Credits / rewards';
    case 'partner-only':
      return 'Partner track only';
    default:
      return 'No program';
  }
}

function referralClass(status: ReferralStatus | undefined): string {
  switch (status) {
    case 'active':
      return 'bg-primary/10 text-primary';
    case 'apply':
      return 'bg-chart-2/15 text-foreground';
    case 'rewards':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted/50 text-muted-foreground';
  }
}

export default function StackPage() {
  const active = PORTFOLIO_STACK.filter((t) => t.referral === 'active');
  const rest = PORTFOLIO_STACK.filter((t) => t.referral !== 'active');

  return (
    <main className="mx-auto max-w-2xl space-y-10 px-4 py-12 sm:py-16">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tech stack</h1>
        <p className="text-muted-foreground">
          What I actually use — and referral programs where they exist. Some links earn me credit
          or commission at no extra cost to you; I only list tools I&apos;d recommend anyway.
        </p>
        <p className="text-sm text-muted-foreground">
          Project-specific stack (Money Manual build log):{' '}
          <Link href="/expat#stack" className="font-medium text-primary hover:underline">
            logans.tools/expat#stack
          </Link>
        </p>
      </div>

      {active.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Referral links (live)</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {active.map((tool) => (
              <li key={tool.label} className="px-4 py-4 sm:px-5">
                <a
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="font-medium text-primary hover:underline"
                >
                  {tool.label}
                </a>
                {tool.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">{tool.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Full stack &amp; referral research</h2>
        <p className="text-sm text-muted-foreground">
          Researched Jun 2026. Programs change — verify before applying.
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-3 font-medium">Tool</th>
                <th className="hidden p-3 font-medium sm:table-cell">Referral</th>
                <th className="p-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((tool) => (
                <tr key={tool.label} className="border-b border-border last:border-0">
                  <td className="p-3 align-top font-medium">
                    {tool.href ? (
                      <a
                        href={tool.href}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="text-primary hover:underline"
                      >
                        {tool.label}
                      </a>
                    ) : tool.programUrl ? (
                      <a
                        href={tool.programUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline"
                      >
                        {tool.label}
                      </a>
                    ) : (
                      tool.label
                    )}
                  </td>
                  <td className="hidden p-3 align-top sm:table-cell">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${referralClass(tool.referral)}`}
                    >
                      {referralLabel(tool.referral)}
                    </span>
                  </td>
                  <td className="p-3 align-top text-muted-foreground">
                    <span className="mb-1 inline-block sm:hidden">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${referralClass(tool.referral)}`}
                      >
                        {referralLabel(tool.referral)}
                      </span>
                    </span>
                    {tool.note ?? '—'}
                    {tool.programUrl && tool.referral === 'apply' ? (
                      <>
                        {' '}
                        <a
                          href={tool.programUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Apply
                        </a>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link href="/" className="inline-block text-sm text-primary hover:underline">
        ← Home
      </Link>
    </main>
  );
}
