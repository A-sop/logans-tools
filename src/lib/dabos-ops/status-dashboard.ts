import fs from 'fs';
import path from 'path';

const DABOS_ROOT = process.env.DABOS_ROOT?.trim() || path.join('C:', 'Dev', 'DABOS');
const APP_ROOT = path.join(process.cwd());
const BACKUP_CONSOLE_LOG = path.join(
  DABOS_ROOT,
  'scripts',
  'dept09-assets',
  'backup',
  'last-backup-console.log'
);
const BACKUP_DEST_MARKERS = path.join('D:', 'C_DRIVE_BACKUP');
const INTAKE_INBOX = path.join('C:', 'DATA', '00_INBOX');
const SCAN_INBOX = path.join('C:', 'LDW_Scan');
const SCAN_WATCHER_MARKER = path.join(APP_ROOT, 'logs', 'scan-watcher-last-run.txt');

export type StatusTone = 'ok' | 'warn' | 'error' | 'muted';

export type BackupStatus = {
  lastRun: string | null;
  exitStatus: string | null;
  tone: StatusTone;
  detail: string;
};

export type FolderCountStatus = {
  count: number | null;
  path: string;
  available: boolean;
};

export type HermesStatus = {
  configured: boolean;
  healthy: boolean | null;
  tone: StatusTone;
  detail: string;
  checkedAt: string;
};

export type LinearIssue = {
  identifier: string;
  title: string;
  priority: number;
  url: string;
  state: string;
};

export type LinearStatus = {
  configured: boolean;
  openCount: number | null;
  issues: LinearIssue[];
  detail: string;
};

export type ScanWatcherStatus = {
  lastRun: string | null;
  available: boolean;
};

export type AtlasDashboardData = {
  backup: BackupStatus;
  documentIntake: FolderCountStatus;
  scanInbox: FolderCountStatus;
  scanWatcher: ScanWatcherStatus;
  hermes: HermesStatus;
  linear: LinearStatus;
};

function readTextFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString('utf16le');
    }
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function readTail(filePath: string, maxBytes = 65536): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const readSize = Math.min(maxBytes, stat.size);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString('utf16le');
    }
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function countFiles(folderPath: string): FolderCountStatus {
  try {
    if (!fs.existsSync(folderPath)) {
      return { count: null, path: folderPath, available: false };
    }
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const count = entries.filter((e) => e.isFile()).length;
    return { count, path: folderPath, available: true };
  } catch {
    return { count: null, path: folderPath, available: false };
  }
}

export function getBackupStatus(): BackupStatus {
  const lastBackupTxt = path.join(BACKUP_DEST_MARKERS, 'last-backup.txt');
  const startedTxt = path.join(BACKUP_DEST_MARKERS, 'backup-started.txt');
  const marker = readTextFile(lastBackupTxt)?.trim();
  if (marker) {
    return {
      lastRun: marker,
      exitStatus: 'OK',
      tone: 'ok',
      detail: 'Last completed run recorded on D: backup root.',
    };
  }

  const started = readTextFile(startedTxt)?.trim();
  const tail = readTail(BACKUP_CONSOLE_LOG);
  if (!tail) {
    return {
      lastRun: null,
      exitStatus: null,
      tone: 'muted',
      detail: 'No backup log found yet.',
    };
  }

  const doneMatch = [...tail.matchAll(/Done\.\s+.+\.\s+Last backup:\s+([^\r\n]+)/gi)].at(-1);
  const exitMatch = [...tail.matchAll(/Robocopy exit code:\s+(\d+)[^\r\n]*/gi)].at(-1);
  const startedMatch = [...tail.matchAll(/Started\s*:\s*([^\r\n]+)/gi)].at(-1);

  if (doneMatch) {
    const exitCode = exitMatch?.[1];
    const code = exitCode ? Number.parseInt(exitCode, 10) : 0;
    const tone: StatusTone = code >= 8 ? 'warn' : 'ok';
    return {
      lastRun: doneMatch[1]?.trim() ?? null,
      exitStatus: exitCode ? `exit ${exitCode}` : 'OK',
      tone,
      detail: code >= 8 ? 'Some files failed — check robocopy.log.' : 'Backup completed.',
    };
  }

  if (started || startedMatch) {
    return {
      lastRun: (started ?? startedMatch?.[1])?.trim() ?? null,
      exitStatus: 'running',
      tone: 'warn',
      detail: 'Backup appears in progress (no completion marker yet).',
    };
  }

  return {
    lastRun: null,
    exitStatus: null,
    tone: 'muted',
    detail: 'Backup log exists but no run metadata parsed.',
  };
}

export function getScanWatcherStatus(): ScanWatcherStatus {
  const lastRun = readTextFile(SCAN_WATCHER_MARKER)?.trim() ?? null;
  return { lastRun, available: fs.existsSync(SCAN_WATCHER_MARKER) || lastRun !== null };
}

async function linearGql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    throw new Error(`Linear API ${res.status}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) {
    throw new Error('Linear API returned no data');
  }
  return json.data;
}

const OPEN_ISSUES_QUERY = /* GraphQL */ `
  query OpenIssues($cursor: String) {
    viewer {
      assignedIssues(
        first: 50
        after: $cursor
        filter: { state: { name: { in: ["Todo", "In Progress", "Backlog", "Triage"] } } }
        orderBy: priority
      ) {
        nodes {
          identifier
          title
          priority
          url
          state {
            name
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export async function getLinearStatus(): Promise<LinearStatus> {
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      openCount: null,
      issues: [],
      detail: 'Set LINEAR_API_KEY in .env.local to show assigned issues.',
    };
  }

  try {
    type IssueNode = {
      identifier: string;
      title: string;
      priority: number;
      url: string;
      state: { name: string };
    };

    type OpenIssuesPage = {
      viewer: {
        assignedIssues: {
          nodes: IssueNode[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
    };

    const all: IssueNode[] = [];
    let cursor: string | null = null;
    let guard = 0;
    do {
      const data: OpenIssuesPage = await linearGql<OpenIssuesPage>(
        apiKey,
        OPEN_ISSUES_QUERY,
        { cursor }
      );

      const page = data.viewer.assignedIssues;
      all.push(...page.nodes);
      if (!page.pageInfo.hasNextPage) break;
      cursor = page.pageInfo.endCursor;
      guard += 1;
    } while (cursor && guard < 5);

    const issues = all
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)
      .map((issue) => ({
        identifier: issue.identifier,
        title: issue.title,
        priority: issue.priority,
        url: issue.url,
        state: issue.state.name,
      }));

    return {
      configured: true,
      openCount: all.length,
      issues,
      detail: `${all.length} open issue${all.length === 1 ? '' : 's'} assigned to you.`,
    };
  } catch (err) {
    return {
      configured: true,
      openCount: null,
      issues: [],
      detail: err instanceof Error ? err.message : 'Linear query failed.',
    };
  }
}

export async function getHermesStatus(): Promise<HermesStatus> {
  const baseUrl = (process.env.HERMES_BASE_URL ?? 'http://localhost:7860').replace(/\/$/, '');
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (res.ok) {
      return {
        configured: true,
        healthy: true,
        tone: 'ok',
        detail: `Responding at ${baseUrl}`,
        checkedAt,
      };
    }
    return {
      configured: true,
      healthy: false,
      tone: 'warn',
      detail: `HTTP ${res.status} from ${baseUrl}/health`,
      checkedAt,
    };
  } catch {
    clearTimeout(timeout);
    return {
      configured: true,
      healthy: false,
      tone: 'error',
      detail: `No response from ${baseUrl}/health`,
      checkedAt,
    };
  }
}

export async function getAtlasDashboardData(): Promise<AtlasDashboardData> {
  const [linear, hermes] = await Promise.all([getLinearStatus(), getHermesStatus()]);
  return {
    backup: getBackupStatus(),
    documentIntake: countFiles(INTAKE_INBOX),
    scanInbox: countFiles(SCAN_INBOX),
    scanWatcher: getScanWatcherStatus(),
    hermes,
    linear,
  };
}
