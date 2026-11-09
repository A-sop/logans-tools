import Link from 'next/link';

import {
  COMM_CENTER_LAYERS,
  COMM_ROUTING_ROWS,
  COMM_ROUTING_SSOT_PATH,
  DEPT2_STAT_NOTES,
} from '@/lib/dabos/comm-routing-table';

export const metadata = {
  title: 'Comm routing — DABOS',
  description: 'Dept2 horizontal / command / conference line types and channel pointers',
};

export default function DabosCommRoutingPage() {
  return (
    <main className="font-sans text-sm">
      <div className="mb-4 max-w-3xl">
        <p className="text-xs text-muted-foreground">
          <Link href="/dabos/systems" className="underline-offset-2 hover:underline">
            ← Systems
          </Link>
        </p>
        <h1 className="text-xl font-semibold tracking-tight">Comm routing</h1>
        <p className="mt-1 text-muted-foreground">
          Dept2 three-line discipline. Scrambling line types = bureaucracy + insolvency. Almost all
          comm is horizontal — seniors watch products and stats, not every despatch.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          SSOT markdown:{' '}
          <code className="rounded bg-muted/50 px-1 py-0.5 font-mono">{COMM_ROUTING_SSOT_PATH}</code>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-3">Line</th>
              <th className="py-2 pr-3">Job</th>
              <th className="py-2 pr-3">Surfaces</th>
              <th className="py-2 pr-3">Pointers</th>
            </tr>
          </thead>
          <tbody>
            {COMM_ROUTING_ROWS.map((row) => (
              <tr key={row.line} className="border-b border-border/60 align-top">
                <td className="py-3 pr-3">
                  <span className="font-semibold text-foreground">{row.label}</span>
                  {row.isDefault ? (
                    <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      default
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-3 max-w-[14rem]">{row.job}</td>
                <td className="py-3 pr-3 max-w-[16rem]">{row.surfaces}</td>
                <td className="py-3 pr-3">
                  <ul className="space-y-1">
                    {row.pointers.map((p) => (
                      <li key={p.href}>
                        <Link
                          href={p.href}
                          className="text-primary underline-offset-2 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {p.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Comm center (one truth)</h2>
        <table className="mt-2 w-full max-w-3xl border-collapse text-xs">
          <tbody>
            {COMM_CENTER_LAYERS.map((row) => (
              <tr key={row.layer} className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">{row.layer}</td>
                <td className="py-2 pr-3">{row.surface}</td>
                <td className="py-2 text-muted-foreground">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
        <h2 className="text-base font-semibold">Dept2 stat: internal_ticket_age</h2>
        <p className="mt-1 text-muted-foreground">{DEPT2_STAT_NOTES.internalTicketAge}</p>
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
          To-report: wire oldest-open across all task sources on /dabos (not shipped in this slice).
        </p>
      </section>
    </main>
  );
}
