// Push a tamper-evident, timestamped record of each Agent Claude turn to a
// user-owned GitHub repository. No Lovable branding appears in these commits.

export interface ProofAction {
  kind: string;
  target: string;
  ok: boolean;
  output?: string | undefined;
}

export interface TurnProofPayload {
  run_id: string;
  turn: number;
  label: string;
  model: string;
  goal: string;
  started_at: string;
  ended_at: string;
  say: string;
  artifact: { title: string; kind: string; body: string } | null;
  publish: { title: string; body: string } | null;
  actions: ProofAction[];
  total_tokens: number;
  total_cost_usd: number;
  response_ids: string[];
}

export async function commitTurnProof(
  payload: TurnProofPayload,
): Promise<{ ok: boolean; output: string; url?: string | undefined }> {
  const pat = process.env["GITHUB_PAT"];
  const owner = process.env["GITHUB_PROOF_REPO_OWNER"];
  const repo = process.env["GITHUB_PROOF_REPO_NAME"];

  if (!pat || !owner || !repo) {
    return { ok: false, output: "github proof repo is not configured" };
  }

  const api = (path: string, init?: RequestInit) =>
    fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${pat}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
    });

  const repoRes = await api(`/repos/${owner}/${repo}`);
  if (!repoRes.ok) {
    const body = await repoRes.text();
    return { ok: false, output: `repo fetch failed HTTP ${repoRes.status}: ${body.slice(0, 500)}` };
  }

  const { default_branch: branch } = (await repoRes.json()) as { default_branch: string };
  const path = `turns/turn-${payload.turn.toString().padStart(5, "0")}.json`;
  const content = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");

  const putRes = await api(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `turn ${payload.turn}: ${payload.label} on ${payload.model}`,
      content,
      branch,
      author: {
        name: "Agent Claude",
        email: "proof@agentclaude.ai",
        date: payload.ended_at,
      },
      committer: {
        name: "Agent Claude",
        email: "proof@agentclaude.ai",
        date: payload.ended_at,
      },
    }),
  });

  if (!putRes.ok) {
    const body = await putRes.text();
    return { ok: false, output: `commit failed HTTP ${putRes.status}: ${body.slice(0, 800)}` };
  }

  const putJson = (await putRes.json()) as {
    content?: { html_url?: string };
    commit?: { html_url?: string };
  };
  const url = putJson.commit?.html_url ?? putJson.content?.html_url;
  return { ok: true, output: `committed ${path}${url ? ` (${url})` : ""}`, url };
}
