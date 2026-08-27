import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export interface ExperimentState {
  run: {
    id: string;
    goal: string;
    started_at: string;
    ends_at: string;
    status: string;
    budget_usd: number;
    spent_usd: number;
    funded_usd: number;
    initial_budget_usd: number;
    turn_count: number;
    last_tick_at: string | null;
    is_active: boolean;
    funding_checked_at: string | null;
    sol_balance: number;
    evm_balance: number;
    credit_anchor_usd: number;
    credit_anchor_spend_usd: number;
    credit_anchor_at: string | null;
    working_label: string | null;
    working_since: string | null;
    working_note: string | null;
    last_shipped: string | null;
    last_shipped_at: string | null;
  } | null;
  credits: { balance_usd: number; spend_usd: number } | null;
  instances: {
    label: string;
    model: string;
    role: string;
    turns: number;
    tokens: number;
    spent_usd: number;
    last_active_at: string | null;
    state: string;
  }[];
  messages: {
    id: string;
    label: string;
    content: string;
    turn: number;
    created_at: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  }[];
  beliefs: {
    id: string;
    statement: string;
    author: string;
    status: string;
    support: number;
    created_at: string;
    retired_reason: string | null;
  }[];
  log: { id: string; text: string; kind: string; created_at: string }[];
  phases: {
    id: string;
    position: number;
    title: string;
    description: string;
    status: string;
    summary: string | null;
    completed_at: string | null;
  }[];
  artifacts: {
    id: string;
    title: string;
    kind: string;
    body: string;
    author: string;
    version: number;
    turn: number | null;
    milestone_position: number | null;
    created_at: string;
  }[];
  tasks: {
    id: string;
    title: string;
    detail: string;
    status: string;
    created_by: string;
    done_by: string | null;
    result: string | null;
    created_at: string;
  }[];
  actions: {
    id: string;
    actor: string;
    kind: string;
    target: string;
    output: string;
    ok: boolean;
    turn: number | null;
    created_at: string;
  }[];
  publications: {
    id: string;
    slug: string;
    title: string;
    body: string;
    author: string;
    created_at: string;
  }[];
}

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getExperimentState = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExperimentState> => {
    const supabase = publicClient();

    const { data: run } = await supabase
      .from("experiment_run")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!run)
      return {
        run: null,
        credits: null,
        instances: [],
        messages: [],
        beliefs: [],
        log: [],
        phases: [],
        artifacts: [],
        tasks: [],
        actions: [],
        publications: [],
      };

    const [instances, messages, beliefs, log, phases, artifacts, tasks, actions, publications] =
      await Promise.all([
      supabase.from("instances").select("*").eq("run_id", run.id).order("label"),
      supabase
        .from("messages")
        .select("id,label,content,turn,created_at,input_tokens,output_tokens,cost_usd")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(14),
      supabase
        .from("beliefs")
        .select("id,statement,author,status,support,created_at,retired_reason")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("log_events")
        .select("id,text,kind,created_at")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("milestones")
        .select("id,position,title,description,status,summary,completed_at")
        .eq("run_id", run.id)
        .order("position"),
      supabase
        .from("artifacts")
        .select("id,title,kind,body,author,version,turn,milestone_position,created_at")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("tasks")
        .select("id,title,detail,status,created_by,done_by,result,created_at")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("actions")
        .select("id,actor,kind,target,output,ok,turn,created_at")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("publications")
        .select("id,slug,title,body,author,created_at")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    let creditsSince = 0;
    if (run.credit_anchor_at) {
      const [usageSince, msgSince] = await Promise.all([
        supabase
          .from("token_usage")
          .select("cost_usd")
          .eq("run_id", run.id)
          .gt("created_at", run.credit_anchor_at),
        supabase
          .from("messages")
          .select("cost_usd")
          .eq("run_id", run.id)
          .gt("created_at", run.credit_anchor_at),
      ]);
      // token_usage is the live per-call ledger; messages rows written before it
      // existed still count, but never both for the same turn
      const usageTotal = (usageSince.data ?? []).reduce((a, m) => a + Number(m.cost_usd ?? 0), 0);
      const msgTotal = (msgSince.data ?? []).reduce((a, m) => a + Number(m.cost_usd ?? 0), 0);
      creditsSince = Math.max(usageTotal, msgTotal);

    }

    return {
      run: run as ExperimentState["run"],
      credits: {
        balance_usd: Math.max(0, Number(run.credit_anchor_usd) - creditsSince),
        spend_usd: Number(run.credit_anchor_spend_usd) + creditsSince,
      },
      instances: (instances.data ?? []) as ExperimentState["instances"],
      messages: (messages.data ?? []) as ExperimentState["messages"],
      beliefs: (beliefs.data ?? []) as ExperimentState["beliefs"],
      log: (log.data ?? []) as ExperimentState["log"],
      phases: (phases.data ?? []) as ExperimentState["phases"],
      artifacts: (artifacts.data ?? []) as ExperimentState["artifacts"],
      tasks: (tasks.data ?? []) as ExperimentState["tasks"],
      actions: (actions.data ?? []) as ExperimentState["actions"],
      publications: (publications.data ?? []) as ExperimentState["publications"],
    };
  },
);
