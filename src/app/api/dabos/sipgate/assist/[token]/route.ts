import { sipgateAssistGet, sipgateAssistPost, sipgateAssistProbe } from '@/lib/dabos/sipgate-assist-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return sipgateAssistPost(request);
}

export async function GET(request: Request) {
  return sipgateAssistGet(request);
}

export async function HEAD(request: Request) {
  return sipgateAssistProbe(request);
}
