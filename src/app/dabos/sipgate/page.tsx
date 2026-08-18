import { setSipgateAssistConsumed } from '@/app/dabos/sipgate/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dabosConfigured } from '@/lib/dabos/server-data';
import { listSipgateAssistEvents } from '@/lib/dabos/sipgate-assist-db';

export const dynamic = 'force-dynamic';

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

export default async function SipgateAssistInboxPage() {
  if (!dabosConfigured()) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Database not configured</CardTitle>
          <CardDescription>Set DATABASE_URL, then npm run dabos:migrate.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const events = await listSipgateAssistEvents(80);
  const pending = events.filter((row) => !row.consumed_at);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">sipgate Assist mailbox</h1>
        <p className="text-sm text-muted-foreground">
          Summaries from shared-channel webhooks. Mitschriften are not stored by default.
          {pending.length > 0 ? ` ${pending.length} pending.` : ' Queue empty.'}
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Paste the webhook URL with <code>?k=</code> into sipgate Labs → AI Assist Webhooks,
              then make a shared-channel test call.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {events.map((row) => (
            <li key={row.id}>
              <Card className={row.consumed_at ? 'opacity-70' : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {row.headline || row.channel_name || 'Call'}
                  </CardTitle>
                  <CardDescription>
                    {formatWhen(row.started_at ?? row.received_at)}
                    {row.duration_seconds != null ? ` · ${row.duration_seconds}s` : ''}
                    {row.direction ? ` · ${row.direction}` : ''}
                    {row.remote_number ? ` · ${row.remote_number}` : ''}
                    {row.consumed_at ? ' · done' : ' · pending'}
                    {row.has_transcript ? ' · Mitschrift stripped' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {row.summary ? (
                    <p className="whitespace-pre-wrap">{row.summary}</p>
                  ) : (
                    <p className="text-muted-foreground">No summary in payload.</p>
                  )}
                  {Array.isArray(row.action_items) && row.action_items.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {row.action_items.map((item, idx) => (
                        <li key={`${row.id}-${idx}`}>{item.text}</li>
                      ))}
                    </ul>
                  ) : null}
                  <form action={setSipgateAssistConsumed.bind(null, row.id, !row.consumed_at)}>
                    <button
                      type="submit"
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      {row.consumed_at ? 'Reopen' : 'Mark done'}
                    </button>
                  </form>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
