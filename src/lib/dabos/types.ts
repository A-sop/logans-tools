export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'cancelled';
export type TaskType = 'human' | 'agent' | 'approval';
export type ConditionLabel = 'Normal' | 'Emergency' | 'Danger';
export type EntityType = 'division' | 'department' | 'workspace' | 'project';

export type DivisionRow = {
  id: string;
  operational_name: string;
  description: string | null;
  primary_metric_key: string | null;
  created_at: string;
};

export type DepartmentRow = {
  id: string;
  division_id: string;
  legacy_name: string;
  operational_name: string;
  policy_text: string | null;
  created_at: string;
};

export type TaskRow = {
  id: string;
  workspace_id: string | null;
  division_id: string;
  department_id: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  assigned_to: string | null;
  assigned_agent: string | null;
  research_tier: number;
  budget_tokens: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type StatRow = {
  id: string;
  workspace_id: string | null;
  division_id: string;
  department_id: string | null;
  metric_key: string;
  value: string;
  recorded_at: string;
};

export type ArtifactRow = {
  id: string;
  workspace_id: string | null;
  division_id: string | null;
  department_id: string | null;
  task_id: string | null;
  type: string;
  summary: string;
  storage_uri: string | null;
  tags: unknown;
  permissions: unknown;
  created_by: string;
  created_at: string;
};

export type CostEventRow = {
  id: string;
  workspace_id: string | null;
  task_id: string | null;
  agent_name: string;
  provider: string;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_eur: string | null;
  category: string;
  created_at: string;
};

export type ConditionEvaluation = {
  condition: ConditionLabel | null;
  confidence: number | null;
  point_count: number;
  basis: Record<string, unknown>;
  reason?: string;
};
