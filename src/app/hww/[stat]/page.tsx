import { redirect } from 'next/navigation';

/** Canonical drill-down is searchParams on /hww; this route keeps /hww/[stat] bookmarks working. */
export default async function HwwStatPage({
  params,
  searchParams,
}: {
  params: Promise<{ stat: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { stat } = await params;
  const q = await searchParams;
  const sp = new URLSearchParams();
  sp.set('stat', stat);
  for (const [k, v] of Object.entries(q)) {
    if (k === 'stat' || v == null) continue;
    sp.set(k, Array.isArray(v) ? v[0]! : v);
  }
  redirect(`/hww?${sp.toString()}`);
}
