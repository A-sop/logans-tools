/** Mirrors DABOS docs/reference/dept02-coordination/comm-routing-table.md */
export type CommLineType = 'horizontal' | 'command' | 'conference';

export type CommRoutingRow = {
  line: CommLineType;
  label: string;
  isDefault: boolean;
  job: string;
  surfaces: string;
  pointers: { label: string; href: string }[];
};

export const COMM_ROUTING_ROWS: CommRoutingRow[] = [
  {
    line: 'horizontal',
    label: 'Horizontal',
    isDefault: true,
    job: 'Fast flow between hats; despatch pointers; default for almost all internal comm.',
    surfaces: 'Buzz #board (Div rooms later) · Neon task baskets (in/pending/out) · ingest → Dept1 → Dept2 despatch',
    pointers: [
      {
        label: 'Comm orchestration §F',
        href: 'https://github.com/A-sop/DABOS/blob/main/docs/reference/founder-office/esto-flap-2026-08-16-stat-mu-and-comm-orchestration.md',
      },
      {
        label: 'Shared ingest I0',
        href: 'https://github.com/A-sop/DABOS/blob/main/docs/reference/dept02-coordination/shared-ingest-i0.md',
      },
      {
        label: 'Agent wake rules',
        href: 'https://github.com/A-sop/DABOS/blob/main/docs/reference/dept02-coordination/agent-wake-rules.md',
      },
    ],
  },
  {
    line: 'command',
    label: 'Command',
    isDefault: false,
    job: 'Founder orders, approve/veto/amend, unusual permissions; Tier0 command peek.',
    surfaces:
      'Slack /dabos · LDW Communicator (Telegram) · Founder IN-baskets (Telegram inbox bot, Buzz #capture, Slack inbox — not Ad Council)',
    pointers: [
      {
        label: 'Order relay RR-010',
        href: 'https://github.com/A-sop/DABOS/blob/main/docs/reference/founder-office/ruling-order-relay-2026-10-31.md',
      },
      {
        label: 'Tier ladder quickref',
        href: 'https://github.com/A-sop/DABOS/blob/main/docs/reference/dept02-coordination/dabos-tier-ladder-quickref.md',
      },
    ],
  },
  {
    line: 'conference',
    label: 'Conference',
    isDefault: false,
    job: 'Program clearance — Ad Council / EC; review stats on /dabos; write recommendation → Neon.',
    surfaces: 'Slack Ad Council / EC room · /dabos board (Neon SSOT; Slack links only, no pasted ledger)',
    pointers: [
      {
        label: 'Ad Council flow §F',
        href: 'https://github.com/A-sop/DABOS/blob/main/docs/reference/founder-office/esto-flap-2026-08-16-stat-mu-and-comm-orchestration.md',
      },
      {
        label: 'Esto secularization',
        href: 'https://github.com/A-sop/DABOS/blob/main/docs/reference/dept15-compliance/esto-source-secularization.md',
      },
    ],
  },
];

export const COMM_CENTER_LAYERS = [
  { layer: 'Comm center', surface: 'Neon + DABOS markdown SSOTs', note: 'Tasks, stats, role_runs' },
  { layer: 'Capture INs', surface: 'Telegram · Slack inbox · Buzz #capture', note: 'Parallel doors → same ingest' },
  { layer: 'Work floor', surface: 'Buzz horizontal', note: 'Busy by design' },
  { layer: 'Workers', surface: 'ln02/HZR crons → run-queued-tasks', note: 'Headless Neon work' },
] as const;

export const DEPT2_STAT_NOTES = {
  internalTicketAge:
    'Oldest open task (hours) across every task source — Linear, Twenty CRM when live, Neon, others. Not yet reported on /dabos; Linear-only reads are partial.',
} as const;

export const COMM_ROUTING_SSOT_PATH =
  'DABOS/docs/reference/dept02-coordination/comm-routing-table.md';
