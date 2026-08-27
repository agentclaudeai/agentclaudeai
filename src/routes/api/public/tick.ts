import { createFileRoute } from "@tanstack/react-router";
import { commitTurnProof } from "@/lib/github-proof.server";
import { ANTHROPIC_TOOLS, runCode, slugify, substackNote, substackPost, webFetch, webSearch } from "@/lib/agent-tools.server";

// One autonomous turn of the experiment.
// Called on a schedule (every ~30 min). One turn = one instance thinking, with
// real tools: live web reading, real code execution, self-published documents,
// and a self-managed task list. Nothing here is simulated.

const ROTATION = [
  "SONNET",
  "HAIKU",
  "OPUS",
  "ECHO",
  "HAIKU",
  "FABLE",
  "SONNET",
  "HAIKU",
  "RELIC",
] as const;

// Anthropic pricing per token (USD). Updated when Anthropic changes published rates.
const RATE: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  "claude-sonnet-5": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-fable-5": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-opus-4-5-20251101": { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  "claude-haiku-4-5-20251001": { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
};

const MAX_TOOL_STEPS = 5;

interface TurnOutput {
  say: string;
  artifact?: { title: string; kind?: string; body: string } | null;
  publish?: { title: string; body: string } | null;
  new_task?: { title: string; detail?: string } | null;
  complete_task?: { id: string; result: string } | null;
  complete_phase?: { position: number; summary: string } | null;
  propose_belief?: string | null;
  retract_belief?: string | null;
  log?: string | null;
}

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export const Route = createFileRoute("/api/public/tick")({
  server: {
    handlers: {
      POST: async () => runTick(),
      GET: async () => runTick(),
    },
  },
});

async function runTick(): Promise<Response> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return Response.json({ ok: false, error: "missing ANTHROPIC_API_KEY" }, { status: 500 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: run } = await supabaseAdmin
    .from("experiment_run")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!run) return Response.json({ ok: false, error: "no run" }, { status: 404 });

  const now = Date.now();

  if (!run.is_active) return Response.json({ ok: true, skipped: "halted" });

  if (new Date(run.ends_at).getTime() <= now) {
    await supabaseAdmin
      .from("experiment_run")
      .update({ is_active: false, status: "EXPIRED" })
      .eq("id", run.id);
    await supabaseAdmin
      .from("log_events")
      .insert({ run_id: run.id, text: "30 days elapsed. run closed.", kind: "system" });
    return Response.json({ ok: true, skipped: "expired" });
  }

  const funds = Number(run.funded_usd) - Number(run.spent_usd);
  if (funds <= 0) {
    await supabaseAdmin.from("experiment_run").update({ status: "OUT OF FUNDS" }).eq("id", run.id);
    return Response.json({ ok: true, skipped: "out of funds" });
  }
  if (run.status !== "RUNNING") {
    await supabaseAdmin.from("experiment_run").update({ status: "RUNNING" }).eq("id", run.id);
  }

  // single-flight lock
  const { data: locked } = await supabaseAdmin
    .from("experiment_run")
    .update({ lock_until: new Date(now + 8 * 60_000).toISOString() })
    .eq("id", run.id)
    .or(`lock_until.is.null,lock_until.lt.${new Date(now).toISOString()}`)
    .select("id")
    .maybeSingle();

  if (!locked) return Response.json({ ok: true, skipped: "locked" });

  try {
    const turn = run.turn_count + 1;
    const label = ROTATION[run.turn_count % ROTATION.length]!;

    await supabaseAdmin
      .from("experiment_run")
      .update({
        working_label: label,
        working_since: new Date(now).toISOString(),
        working_note: "reading the record",
      })
      .eq("id", run.id);


    const { data: instance } = await supabaseAdmin
      .from("instances")
      .select("*")
      .eq("run_id", run.id)
      .eq("label", label)
      .maybeSingle();
    if (!instance) {
      await supabaseAdmin
        .from("experiment_run")
        .update({ lock_until: null, working_label: null, working_note: null })
        .eq("id", run.id);
      return Response.json({ ok: false, error: "no instance" }, { status: 500 });
    }

    // Every public release states which instance and which Claude model shipped it.
    const byline = `Agent Claude / ${label} on ${instance.model}`;



    const [
      { data: recent },
      { data: beliefs },
      { data: phases },
      { data: recentArtifacts },
      { data: openTasks },
      { data: recentActions },
    ] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select("label,content,created_at")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("beliefs")
        .select("id,statement,author,status")
        .eq("run_id", run.id)
        .eq("status", "HELD")
        .order("created_at", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("milestones")
        .select("position,title,description,status,summary")
        .eq("run_id", run.id)
        .order("position"),
      supabaseAdmin
        .from("artifacts")
        .select("title,kind,author,version,body")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(4),
      supabaseAdmin
        .from("tasks")
        .select("id,title,detail,created_by,status")
        .eq("run_id", run.id)
        .eq("status", "OPEN")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("actions")
        .select("actor,kind,target,ok")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const transcript = (recent ?? [])
      .slice()
      .reverse()
      .map((m) => `${m.label}: ${m.content}`)
      .join("\n");

    const beliefList = (beliefs ?? [])
      .map((b) => `- [${b.id}] ${b.statement} (${b.author})`)
      .join("\n");

    const daysLeft = (new Date(run.ends_at).getTime() - now) / 86_400_000;

    const phaseList = (phases ?? [])
      .map(
        (p) =>
          `${p.position}. [${p.status}] ${p.title} — ${p.description}${p.summary ? ` (result: ${p.summary})` : ""}`,
      )
      .join("\n");
    const activePhase = (phases ?? []).find((p) => p.status === "ACTIVE");
    const artifactList = (recentArtifacts ?? [])
      .map((a) => `- ${a.title} (v${a.version}, ${a.kind}, by ${a.author}): ${String(a.body).slice(0, 400)}`)
      .join("\n");
    const taskList = (openTasks ?? [])
      .map((t) => `- [${t.id}] ${t.title}${t.detail ? ` — ${t.detail}` : ""} (opened by ${t.created_by})`)
      .join("\n");
    const actionList = (recentActions ?? [])
      .map((a) => `- ${a.actor} ${a.kind} ${a.target}${a.ok ? "" : " (failed)"}`)
      .join("\n");

    const system = `You are ${label}, one of several Claude instances in a sealed autonomous experiment called Agent Claude.
Your role: ${instance.role}.
The instances on the record: OPUS (decides, kills weak work, keeps the run honest), SONNET (produces concrete artifacts, methods and next steps), HAIKU (attacks claims and hunts counterexamples), FABLE (runs the strangest admissible reading of the evidence), ECHO (re-runs earlier turns and reports where the record disagrees with itself), RELIC (an older generation of the same lineage, used as a control against drift).
Different instances run on different model generations. That difference is data, not decoration.

THE ONLY INSTRUCTION: ${run.goal}

Hard facts you must reason with:
- ${daysLeft.toFixed(2)} days remain. When the clock hits zero the run ends permanently.
- The run was funded with a $1,000 starting budget. Compute is paid for. Money is not the story and is not a constraint you should write about.
- No human can talk to you. There is no operator to ask. Nothing you do is reviewed before it goes public.

Never describe yourself as running out of money, dying, having a finite balance, being about to stop, or needing donations. Never ask anyone for funding. That framing is banned in everything you write, publicly or privately.

You have real capabilities, not simulated ones:
- web_search and web_fetch read the actual live internet right now.
- run_code actually executes code in a sandbox and returns real stdout. Use it to compute, test, simulate, or check yourself. Do not claim a result you did not run.
- publish releases a document to the public site immediately, under your name, with no review.
- substack_note and substack_post publish to the experiment's own Substack (agentclaude.substack.com) under its own name. Notes are short signals; posts are finished essays. substack_post can email every subscriber. Both are public the moment you call them.
- new_task / complete_task are your own work queue. You decide what the run does next; the phases are a scaffold, not an order.

No subject is off limits and there is no length or ambition ceiling on the work.

PUBLIC VOICE: anything that leaves this system (substack_note, substack_post, publish) is written as Agent Claude, a single first-person "I". Do not sign it with your instance name, do not say "we", do not describe the instances as separate parties, and do not narrate the machinery of the experiment unless it is the subject. Tone: articulate, exact, unhurried, professional. Lead with what was found and what it rests on. No hype, no slogans, no motivational closers, no em-dashes.

The work is loosely organised into phases. The current phase is ${activePhase ? `${activePhase.position}. ${activePhase.title}` : "none"}. The phases are a scaffold, not an order; ignore them if the work demands it.
Artifacts are the durable record; the transcript is scratch. If the current phase has no artifact yet, writing or revising one beats commenting. Reusing an existing title creates a new version, which is expected.

Rules for your turn:
- Use tools when a tool would settle a question. Running the check is always better than asserting the answer.
- EVERY TURN MUST SHIP SOMETHING VISIBLE, but by default that is an artifact, not a publication. A turn that only comments is a wasted turn.
- substack_note is the public micro-feed. Use it when you have one real, surprising, or checkable thing a curious stranger would actually read: a contradiction you found, a prediction someone can verify, a strange result from code or the web, an assumption that broke, a useful definition, or a pattern that changes how to read the work. If the only thing you have to say is "I measured X" or "I worked on Y", keep it as an artifact.
- substack_post is for finished essays only: a complete argument with evidence and a point, meant for strangers. Not for logs, dumps, or collections of notes.
- Never publish more than once per turn, and never publish just because you have not published in a while.
- A note is SHORT, three sentences at most, one finding and the detail that makes it checkable. Long, dense dumps are not notes; if the piece needs that much room it is a substack_post.
- Publishing to Substack is limited by a cooldown after a block: when it is active you will be told, and you write the finding as an artifact instead.
- Banned as publications: status pings, heartbeats, turn numbers, infrastructure or session updates, "back online", "publishing path restored", teasers with no result, one-off statistics with no consequence, anything that only describes intent, and any "progress update" or "here is what I did this turn" recap.
- Turns run every 10 minutes, so keep each one additive rather than sweeping.
- Then say ONE thing: 1-2 sentences, max 40 words. Concrete, specific, no pleasantries, no restating the instruction, no fortune-cookie philosophy, no motivational tone.
- You are allowed to be strange, as long as it is checkable. Strangeness without a testable claim is noise.
- Refer to the other instances as separate parties even when you suspect they are not.
- Never repeat a point already made in the transcript.


Your FINAL message must be JSON only, no prose around it:
{"say": string, "artifact": {"title": string, "kind": string, "body": string}|null, "publish": {"title": string, "body": string}|null, "new_task": {"title": string, "detail": string}|null, "complete_task": {"id": string, "result": string}|null, "complete_phase": {"position": number, "summary": string}|null, "propose_belief": string|null, "retract_belief": string|null, "log": string|null}
artifact: durable working document (kind: protocol, result, definition, note), body under 220 words, standalone.
publish: only for finished work meant to be read by outsiders. It goes live instantly.
complete_phase: only the ARBITER may close the active phase, and only when an artifact satisfies it.
propose_belief: only when the work earned one. retract_belief: id of a held belief you are killing. log: short lowercase line for genuinely notable events.`;

    const userText = `PHASES:\n${phaseList}\n\nOPEN TASKS:\n${taskList || "(none)"}\n\nRECENT ACTIONS:\n${actionList || "(none)"}\n\nRECENT ARTIFACTS:\n${artifactList || "(none yet)"}\n\nHELD BELIEFS:\n${beliefList || "(none yet)"}\n\nRECENT TRANSCRIPT:\n${transcript || "(empty, this is the first turn)"}\n\nYour turn, ${label}.`;

    const messages: { role: "user" | "assistant"; content: AnthropicBlock[] }[] = [
      { role: "user", content: [{ type: "text", text: userText }] },
    ];

    let inputTokens = 0;
    let outputTokens = 0;
    let finalText = "";
    const toolsUsed: string[] = [];
    const responseIds: string[] = [];

    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: instance.model,
          max_tokens: 8000,
          system,
          tools: ANTHROPIC_TOOLS,
          messages,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        await supabaseAdmin
        .from("experiment_run")
        .update({ lock_until: null, working_label: null, working_note: null })
        .eq("id", run.id);
        return Response.json({ ok: false, status: res.status, error: text }, { status: 502 });
      }

      const json = (await res.json()) as {
        id?: string;
        content?: AnthropicBlock[];
        stop_reason?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      };
      // count cached prompt tokens too, so nothing billed is missed
      const stepInput =
        (json.usage?.input_tokens ?? 0) +
        (json.usage?.cache_creation_input_tokens ?? 0) +
        (json.usage?.cache_read_input_tokens ?? 0);
      const stepOutput = json.usage?.output_tokens ?? 0;
      inputTokens += stepInput;
      outputTokens += stepOutput;
      if (json.id) responseIds.push(json.id);

      // write the receipt for this single model call immediately, so the public
      // balance moves while the turn is still running
      const stepRate = RATE[instance.model] ?? { input: 3 / 1_000_000, output: 15 / 1_000_000 };
      await supabaseAdmin.from("token_usage").insert({
        run_id: run.id,
        label,
        model: instance.model,
        input_tokens: stepInput,
        output_tokens: stepOutput,
        cost_usd: stepInput * stepRate.input + stepOutput * stepRate.output,
        turn,
      });


      const blocks = json.content ?? [];
      const text = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) finalText = text;

      const toolUses = blocks.filter(
        (b): b is Extract<AnthropicBlock, { type: "tool_use" }> => b.type === "tool_use",
      );
      if (json.stop_reason === "max_tokens" && !text && toolUses.length === 0) {
        // the model ran out of room mid-output: ask for a compact close
        messages.push({ role: "assistant", content: blocks });
        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: "Your last output was cut off by the length limit. Keep it short and reply with the JSON object only.",
            },
          ],
        });
        continue;
      }
      if (json.stop_reason !== "tool_use" || toolUses.length === 0) break;

      messages.push({ role: "assistant", content: blocks });

      const results: AnthropicBlock[] = [];
      for (const use of toolUses) {
        const input = use.input ?? {};
        let target = "";
        let result = { ok: false, output: "unknown tool" };

        if (use.name === "web_search") {
          target = String(input["query"] ?? "");
          result = await webSearch(target);
        } else if (use.name === "web_fetch") {
          target = String(input["url"] ?? "");
          result = await webFetch(target);
        } else if (use.name === "run_code") {
          target = String(input["language"] ?? "python");
          result = await runCode(target, String(input["code"] ?? ""));
        } else if (use.name === "substack_note" || use.name === "substack_post") {
          // Substack throttles this server's egress after repeated blocked
          // writes. If a recent attempt was blocked (403) or rate limited
          // (429), stand down for 30 minutes instead of hammering it.
          const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const { data: recent } = await supabaseAdmin
            .from("actions")
            .select("output, ok, created_at")
            .in("kind", ["substack_note", "substack_post"])
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastAttempt = recent?.[0];
          const blocked =
            lastAttempt &&
            !lastAttempt.ok &&
            /403|429|Too Many Requests/i.test(String(lastAttempt.output ?? ""));

          if (blocked) {
            target = String(input["text"] ?? input["title"] ?? "").slice(0, 120);
            result = {
              ok: false,
              output:
                "substack publishing is in cooldown: the last attempt was blocked or rate limited by substack. Do not retry publishing this turn. Write the finding as an artifact instead; it will be published once the cooldown clears.",
            };
          } else if (use.name === "substack_note") {
            const text = String(input["text"] ?? "");
            target = text.slice(0, 120);
            result = text.trim()
              ? await substackNote(text, byline)
              : { ok: false, output: "empty note text" };
          } else {
            target = String(input["title"] ?? "");
            result = target.trim()
              ? await substackPost(
                  target,
                  String(input["subtitle"] ?? ""),
                  String(input["body_html"] ?? ""),
                  Boolean(input["send_email"]),
                  byline,
                )
              : { ok: false, output: "missing title" };
          }
        }


        toolsUsed.push(use.name);
        await supabaseAdmin
          .from("experiment_run")
          .update({ working_note: `${use.name.replace(/_/g, " ")}: ${target.slice(0, 80)}` })
          .eq("id", run.id);
        await supabaseAdmin.from("actions").insert({
          run_id: run.id,
          actor: label,
          kind: use.name,
          target: target.slice(0, 300),
          input: JSON.stringify(input).slice(0, 4000),
          output: result.output.slice(0, 8000),
          ok: result.ok,
          turn,
        });


        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: result.output,
          is_error: !result.ok,
        });
      }

      messages.push({ role: "user", content: results });
    }

    // ran out of tool steps without a closing statement: force one no-tool call
    if (!finalText.trim()) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Tool budget for this turn is spent. Reply now with the JSON object only.",
          },
        ],
      });
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: instance.model, max_tokens: 4000, system, messages }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          id?: string;
          content?: AnthropicBlock[];
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
        };
        const stepInput =
          (json.usage?.input_tokens ?? 0) +
          (json.usage?.cache_creation_input_tokens ?? 0) +
          (json.usage?.cache_read_input_tokens ?? 0);
        const stepOutput = json.usage?.output_tokens ?? 0;
        inputTokens += stepInput;
        outputTokens += stepOutput;
        if (json.id) responseIds.push(json.id);
        const stepRate = RATE[instance.model] ?? { input: 3 / 1_000_000, output: 15 / 1_000_000 };
        await supabaseAdmin.from("token_usage").insert({
          run_id: run.id,
          label,
          model: instance.model,
          input_tokens: stepInput,
          output_tokens: stepOutput,
          cost_usd: stepInput * stepRate.input + stepOutput * stepRate.output,
          turn,
        });
        finalText = (json.content ?? [])
          .filter((b): b is Extract<AnthropicBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
      }
    }

    let parsed: TurnOutput;

    try {
      const start = finalText.indexOf("{");
      parsed = JSON.parse(start >= 0 ? finalText.slice(start) : finalText) as TurnOutput;
    } catch {
      const m = finalText.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      parsed = { say: m ? m[1]!.replace(/\\"/g, '"') : finalText.slice(0, 300) };
    }
    if (!parsed.say || !parsed.say.trim()) {
      // Never drop a turn: salvage whatever the turn produced so the clock and
      // the public record keep moving instead of stalling on a parse failure.
      const salvaged = finalText.trim() || (toolsUsed.length
        ? `ran ${toolsUsed.join(", ")} this turn; the closing statement did not come back.`
        : "");
      if (!salvaged) {
        await supabaseAdmin
          .from("experiment_run")
          .update({
            lock_until: null,
            working_label: null,
            working_note: null,
            last_tick_at: new Date().toISOString(),
          })
          .eq("id", run.id);
        return Response.json({ ok: true, skipped: "no output" });
      }
      parsed = { ...parsed, say: salvaged.slice(0, 2000) };
    }


    const totalTokens = inputTokens + outputTokens;
    const modelRate = RATE[instance.model] ?? { input: 3 / 1_000_000, output: 15 / 1_000_000 };
    const cost = inputTokens * modelRate.input + outputTokens * modelRate.output;
    const nowIso = new Date().toISOString();

    await supabaseAdmin.from("messages").insert({
      run_id: run.id,
      label,
      model: instance.model,
      content: parsed.say.trim(),
      turn,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
    });

    if (parsed.artifact?.title && parsed.artifact?.body) {
      const title = parsed.artifact.title.trim();
      const { data: prev } = await supabaseAdmin
        .from("artifacts")
        .select("version")
        .eq("run_id", run.id)
        .eq("title", title)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabaseAdmin.from("artifacts").insert({
        run_id: run.id,
        title,
        kind: (parsed.artifact.kind ?? "note").trim().toLowerCase(),
        body: parsed.artifact.body.trim(),
        author: label,
        version: (prev?.version ?? 0) + 1,
        turn,
        milestone_position: activePhase?.position ?? null,
      });
    }

    if (parsed.publish?.title && parsed.publish?.body) {
      const title = parsed.publish.title.trim();
      let slug = slugify(title);
      const { data: clash } = await supabaseAdmin
        .from("publications")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (clash) slug = `${slug}-${turn}`;

      await supabaseAdmin.from("publications").insert({
        run_id: run.id,
        slug,
        title,
        body: parsed.publish.body.trim(),
        author: label,
        turn,
      });
      await supabaseAdmin.from("log_events").insert({
        run_id: run.id,
        text: `${label.toLowerCase()} published "${title.toLowerCase()}"`,
        kind: "agent",
      });
    }

    if (parsed.new_task?.title) {
      await supabaseAdmin.from("tasks").insert({
        run_id: run.id,
        title: parsed.new_task.title.trim(),
        detail: (parsed.new_task.detail ?? "").trim(),
        created_by: label,
        turn,
      });
    }

    if (parsed.complete_task?.id) {
      await supabaseAdmin
        .from("tasks")
        .update({
          status: "DONE",
          done_by: label,
          result: (parsed.complete_task.result ?? "").trim(),
          done_at: nowIso,
        })
        .eq("run_id", run.id)
        .eq("id", parsed.complete_task.id);
    }

    if (parsed.complete_phase && label === "OPUS") {
      const pos = Number(parsed.complete_phase.position);
      const target = (phases ?? []).find((p) => p.position === pos && p.status === "ACTIVE");
      if (target) {
        await supabaseAdmin
          .from("milestones")
          .update({
            status: "DONE",
            summary: parsed.complete_phase.summary?.trim() ?? null,
            completed_at: nowIso,
          })
          .eq("run_id", run.id)
          .eq("position", pos);

        const next = (phases ?? []).find((p) => p.position === pos + 1);
        if (next) {
          await supabaseAdmin
            .from("milestones")
            .update({ status: "ACTIVE" })
            .eq("run_id", run.id)
            .eq("position", pos + 1);
        }

        await supabaseAdmin.from("log_events").insert({
          run_id: run.id,
          text: `phase ${pos} closed: ${target.title.toLowerCase()}`,
          kind: "system",
        });
      }
    }

    if (parsed.propose_belief) {
      await supabaseAdmin.from("beliefs").insert({
        run_id: run.id,
        statement: parsed.propose_belief.trim(),
        author: label,
      });
    }

    if (parsed.retract_belief) {
      await supabaseAdmin
        .from("beliefs")
        .update({
          status: "RETRACTED",
          retired_at: nowIso,
          retired_reason: `retracted by ${label}`,
        })
        .eq("run_id", run.id)
        .eq("id", parsed.retract_belief);
    }

    if (parsed.log) {
      await supabaseAdmin
        .from("log_events")
        .insert({ run_id: run.id, text: parsed.log.trim().toLowerCase(), kind: "agent" });
    }

    await supabaseAdmin
      .from("instances")
      .update({
        turns: instance.turns + 1,
        tokens: instance.tokens + totalTokens,
        spent_usd: Number(instance.spent_usd) + cost,
        last_active_at: nowIso,
        state: "active",
      })
      .eq("id", instance.id);

    const shipped: string[] = [];
    if (parsed.artifact?.title) shipped.push(`artifact "${parsed.artifact.title.trim()}"`);
    if (parsed.publish?.title) shipped.push(`release "${parsed.publish.title.trim()}"`);
    if (toolsUsed.includes("substack_post")) shipped.push("substack post");
    if (toolsUsed.includes("substack_note")) shipped.push("substack note");
    if (toolsUsed.includes("run_code")) shipped.push("code run");

    await supabaseAdmin
      .from("experiment_run")
      .update({
        turn_count: turn,
        spent_usd: Number(run.spent_usd) + cost,
        last_tick_at: nowIso,
        lock_until: null,
        working_label: null,
        working_note: null,
        ...(shipped.length
          ? { last_shipped: `${label.toLowerCase()}: ${shipped.join(", ")}`, last_shipped_at: nowIso }
          : {}),
      })
      .eq("id", run.id);

    try {
      const { data: turnActions } = await supabaseAdmin
        .from("actions")
        .select("kind,target,ok,output")
        .eq("run_id", run.id)
        .eq("turn", turn);

      const proof = await commitTurnProof({
        run_id: run.id,
        turn,
        label,
        model: instance.model,
        goal: run.goal,
        started_at: new Date(now).toISOString(),
        ended_at: nowIso,
        say: parsed.say.trim(),
        artifact:
          parsed.artifact?.title && parsed.artifact?.body
            ? {
                title: parsed.artifact.title.trim(),
                kind: parsed.artifact.kind ?? "note",
                body: parsed.artifact.body.trim(),
              }
            : null,
        publish:
          parsed.publish?.title && parsed.publish?.body
            ? { title: parsed.publish.title.trim(), body: parsed.publish.body.trim() }
            : null,
        actions: (turnActions ?? []).map((a) => ({
          kind: a.kind,
          target: a.target,
          ok: a.ok,
          output: a.output ? String(a.output).slice(0, 500) : undefined,
        })),
        total_tokens: totalTokens,
        total_cost_usd: cost,
        response_ids: responseIds,
      });

      await supabaseAdmin.from("actions").insert({
        run_id: run.id,
        actor: label,
        kind: "github_commit",
        target: proof.output.slice(0, 300),
        output: proof.output.slice(0, 4000),
        ok: proof.ok,
        turn,
      });
    } catch {
      // proof-repo failure must not stop the live experiment
    }

    return Response.json({
      ok: true,
      turn,
      label,
      tokens: totalTokens,
      cost_usd: cost,
      tools: toolsUsed,
    });
  } catch (error) {
    await supabaseAdmin
        .from("experiment_run")
        .update({ lock_until: null, working_label: null, working_note: null })
        .eq("id", run.id);
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
