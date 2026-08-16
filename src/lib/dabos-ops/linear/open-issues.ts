function getApiKey(): string | undefined {
  return process.env.LINEAR_API_KEY?.trim();
}

export type LinearOpenIssue = {
  identifier: string;
  title: string;
  priority: number;
  url: string;
  updatedAt: string;
  state: { name: string; type: string };
  team: { key: string };
};

type IssueNode = LinearOpenIssue;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('LINEAR_API_KEY not set');
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(json.errors.map((error) => error.message).join('; '));
  if (!json.data) throw new Error('No data from Linear');
  return json.data;
}

const OPEN_ISSUES_QUERY = /* GraphQL */ `
  query OpenIssues($cursor: String) {
    issues(
      first: 50
      after: $cursor
      filter: { state: { type: { nin: ["completed", "canceled"] } } }
      orderBy: updatedAt
    ) {
      nodes {
        identifier
        title
        priority
        url
        updatedAt
        state {
          name
          type
        }
        team {
          key
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function fetchLinearOpenIssues(): Promise<LinearOpenIssue[]> {
  const all: IssueNode[] = [];
  let cursor: string | null = null;

  for (;;) {
    const data: {
      issues: { nodes: IssueNode[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
    } = await gql(OPEN_ISSUES_QUERY, { cursor });
    all.push(...data.issues.nodes);
    if (!data.issues.pageInfo.hasNextPage) break;
    cursor = data.issues.pageInfo.endCursor;
  }

  return all.sort((a, b) => a.priority - b.priority || a.identifier.localeCompare(b.identifier));
}

export function hasLinearApiKey(): boolean {
  return Boolean(getApiKey());
}
