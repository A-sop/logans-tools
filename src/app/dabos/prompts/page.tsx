import Link from 'next/link';

import { dabosConfigured } from '@/lib/dabos/server-data';
import { fetchPromptRegisterTasks } from '@/lib/dabos/prompt-register';

export const metadata = {
  title: 'Prompt register — DABOS',
  description: 'Cursor prompt register mirror (metadata only; no bodies)',
};

export const dynamic = 'force-dynamic';

type Search = {
  machine?: string;
  status?: string;
  dept?: string;
  needsLogan?: string;
  inPerson?: string;
  q?: string;
  id?: string;
};

export default async function DabosPromptsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  if (!dabosConfigured()) {
    return (
      <main className="font-sans text-sm">
        <h1 className="text-xl font-semibold">Prompt register</h1>
        <p className="mt-2 text-muted-foreground">Configure DATABASE_URL to load the Neon mirror.</p>
      </main>
    );
  }

  const rows = await fetchPromptRegisterTasks({
    machine: sp.machine,
    status: sp.status,
    dept: sp.dept,
    needsLogan: sp.needsLogan,
    inPerson: sp.inPerson,
    q: sp.q,
  });
  const selected = sp.id ? rows.find((r) => r.register_id === sp.id) : null;

  return (
    <main className="font-sans text-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prompt register</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Neon mirror of ln02 metadata. No prompt bodies. Edit status on ln02 via Set-PromptStatus /
            preg set.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{rows.length} items</p>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search title/id"
          className="rounded border border-border bg-background px-2 py-1"
        />
        <select name="machine" defaultValue={sp.machine ?? 'all'} className="rounded border px-2 py-1">
          <option value="all">All machines</option>
          <option value="HZR">HZR</option>
          <option value="LDW">LDW</option>
          <option value="ln02">ln02</option>
        </select>
        <select name="status" defaultValue={sp.status ?? 'all'} className="rounded border px-2 py-1">
          <option value="all">All status</option>
          <option value="not_started">not_started</option>
          <option value="running">running</option>
          <option value="blocked">blocked</option>
          <option value="review">review</option>
          <option value="done">done</option>
          <option value="parked">parked</option>
        </select>
        <input
          name="dept"
          defaultValue={sp.dept ?? ''}
          placeholder="Dept"
          className="w-24 rounded border px-2 py-1"
        />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="needsLogan" value="y" defaultChecked={sp.needsLogan === 'y'} />
          needs Logan
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="inPerson" value="y" defaultChecked={sp.inPerson === 'y'} />
          in person
        </label>
        <button type="submit" className="rounded bg-foreground px-3 py-1 text-background">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-2">id</th>
              <th className="py-2 pr-2">title</th>
              <th className="py-2 pr-2">machine</th>
              <th className="py-2 pr-2">status</th>
              <th className="py-2 pr-2">blocker</th>
              <th className="py-2 pr-2">Logan / person</th>
              <th className="py-2 pr-2">estimate</th>
              <th className="py-2 pr-2">dept</th>
              <th className="py-2 pr-2">stale</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.register_id} className="border-b border-border/60 align-top">
                <td className="py-2 pr-2 font-mono">
                  <Link className="underline-offset-2 hover:underline" href={`/dabos/prompts?id=${encodeURIComponent(r.register_id)}`}>
                    {r.register_id}
                  </Link>
                </td>
                <td className="py-2 pr-2">{r.title}</td>
                <td className="py-2 pr-2">{r.machine || '—'}</td>
                <td className="py-2 pr-2">{r.register_status || r.status}</td>
                <td className="py-2 pr-2 max-w-[14rem] truncate" title={r.blocker}>
                  {r.blocker || '—'}
                </td>
                <td className="py-2 pr-2">
                  {r.needs_logan}/{r.in_person}
                </td>
                <td className="py-2 pr-2">{r.estimate || '—'}</td>
                <td className="py-2 pr-2">{r.dept || '—'}</td>
                <td className="py-2 pr-2">{r.stale ? 'yes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <section className="mt-6 rounded border border-border p-4">
          <h2 className="text-base font-semibold">{selected.register_id}</h2>
          <p className="mt-1 text-muted-foreground">{selected.title}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Neon task</dt>
              <dd className="font-mono text-xs">{selected.task_id}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Source</dt>
              <dd>{selected.source || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Output path</dt>
              <dd className="break-all">{selected.output_path || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">PRs</dt>
              <dd className="break-all">{selected.prs || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Paste line (no body)</dt>
              <dd className="mt-1 rounded bg-muted/40 p-2 font-mono text-xs">{selected.paste_line}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">ln02 path</dt>
              <dd className="font-mono text-xs">
                ~/dabos-data/prompt-register/items/{selected.register_id}.md
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Full prompt body is not shown on this page.</p>
        </section>
      ) : null}
    </main>
  );
}
