import { DilReviewShell } from '@/components/atlas-ops/dil/dil-review-shell';

export const metadata = {
  title: 'DIL Review — DABOS',
  description:
    'DIL (Document Intake & Lifecycle) — review files and Chrome bookmarks before apply or delete',
};

export const dynamic = 'force-dynamic';

export default function DabosDilReviewPage() {
  return <DilReviewShell />;
}
