import {
  parseDigestNeedLine,
  type PendingApproval,
} from '@/lib/dabos/status-digest';

const GITHUB_OWNER = 'A-sop';

export type DigestNeedKind = 'pr' | 'approval' | 'unknown';

export type DigestNeedItem = {
  kind: DigestNeedKind;
  title: string;
  ref: string | null;
  note: string | null;
  href: string | null;
  approvalId: string | null;
};

const AQ_TAG_RE = /\[aq:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i;

/** PR ref → github.com pull URL (A-sop org). */
export function githubPullUrlFromRef(ref: string): string | null {
  const m = ref.match(/^([^#(]+)#(\d+)/);
  if (!m) return null;
  const repo = m[1]!.trim();
  const num = m[2]!;
  return `https://github.com/${GITHUB_OWNER}/${repo}/pull/${num}`;
}

function parseApprovalLine(raw: string): Omit<DigestNeedItem, 'href'> | null {
  const withId = raw.match(
    /^Approval waiting\s+\[aq:([0-9a-f-]{36})\]\s*\(([^)]+)\):\s*(.+)$/i
  );
  if (withId) {
    const meta = withId[2]!.trim();
    const note = meta.includes('since') ? meta : meta;
    return {
      kind: 'approval',
      approvalId: withId[1]!.toLowerCase(),
      title: withId[3]!.trim(),
      ref: null,
      note,
    };
  }
  const legacy = raw.match(/^Approval waiting\s*\(([^)]+)\):\s*(.+)$/i);
  if (legacy) {
    return {
      kind: 'approval',
      approvalId: null,
      title: legacy[2]!.trim(),
      ref: null,
      note: legacy[1]!.trim(),
    };
  }
  return null;
}

export function parseDigestNeedItem(line: string): DigestNeedItem {
  const raw = line.replace(/\s+/g, ' ').trim();
  const aqInline = raw.match(AQ_TAG_RE);
  const approval = parseApprovalLine(raw.replace(/^Ready to merge:\s*/i, ''));
  if (approval) {
    const id = approval.approvalId ?? (aqInline ? aqInline[1]!.toLowerCase() : null);
    return {
      ...approval,
      approvalId: id,
      href: id ? `/dabos/approvals/${id}` : '/dabos/approvals',
    };
  }

  const prParts = parseDigestNeedLine(line);
  if (prParts.ref) {
    return {
      kind: 'pr',
      title: prParts.title,
      ref: prParts.ref,
      note: prParts.note,
      href: githubPullUrlFromRef(prParts.ref),
      approvalId: null,
    };
  }

  return {
    kind: 'unknown',
    title: prParts.title,
    ref: null,
    note: null,
    href: null,
    approvalId: null,
  };
}

/** Match legacy digest lines (no aq tag) to live pending rows by exact title. */
export function enrichDigestNeedItems(
  lines: string[],
  pending: PendingApproval[]
): DigestNeedItem[] {
  const byTitle = new Map(pending.map((a) => [a.title.trim(), a.id]));
  return lines.map((line) => {
    const item = parseDigestNeedItem(line);
    if (item.kind === 'approval' && !item.approvalId) {
      const id = byTitle.get(item.title);
      if (id) {
        return { ...item, approvalId: id, href: `/dabos/approvals/${id}` };
      }
    }
    return item;
  });
}
