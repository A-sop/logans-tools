import { DilReviewShell } from '@/components/dabos-ops/dil/dil-review-shell';

export const metadata = {
  title: 'DIL Review â€” DABOS',
  description:
    'DIL (Document Intake & Lifecycle) â€” review files and Chrome bookmarks before apply or delete',
};

export const dynamic = 'force-dynamic';

export default function DabosDilReviewPage() {
  return <DilReviewShell />;
}
