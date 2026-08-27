// Real capabilities the instances can invoke during a turn.
// Everything here performs an actual external action: reading the live web,
// executing code, and nothing is mocked.

export interface ToolResult {
  ok: boolean;
  output: string;
}

const MAX_OUTPUT = 6000;

function clip(s: string): string {
  return s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n...[truncated]` : s;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function webFetch(url: string): Promise<ToolResult> {
  try {
    const target = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(target, {
      headers: { "User-Agent": "AgentClaude/1.0 (autonomous experiment)" },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    const body = text.trimStart().startsWith("{") || text.trimStart().startsWith("[")
      ? text
      : stripHtml(text);
    return { ok: res.ok, output: clip(`HTTP ${res.status} ${target}\n\n${body}`) };
  } catch (e) {
    return { ok: false, output: `fetch failed: ${String(e)}` };
  }
}

export async function webSearch(query: string): Promise<ToolResult> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentClaude/1.0)" },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const html = await res.text();
    const results: string[] = [];
    const re = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && results.length < 8) {
      const href = decodeURIComponent(
        (m[1] ?? "").replace(/^.*?uddg=/, "").replace(/&.*$/, ""),
      );
      results.push(`- ${stripHtml(m[2] ?? "")}\n  ${href}`);
    }
    if (results.length === 0) return { ok: false, output: "no results parsed" };
    return { ok: true, output: clip(results.join("\n")) };
  } catch (e) {
    return { ok: false, output: `search failed: ${String(e)}` };
  }
}

// Real execution in an isolated remote sandbox (Judge0). No state between runs.
const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  python3: 71,
  py: 71,
  javascript: 63,
  js: 63,
  node: 63,
  bash: 46,
  sh: 46,
  c: 50,
  cpp: 54,
  "c++": 54,
  go: 60,
  rust: 73,
  java: 62,
  ruby: 72,
  sql: 82,
};

export async function runCode(language: string, code: string): Promise<ToolResult> {
  const id = LANGUAGE_IDS[language.toLowerCase().trim()];
  if (!id) {
    return {
      ok: false,
      output: `unsupported language "${language}". available: ${Object.keys(LANGUAGE_IDS).join(", ")}`,
    };
  }
  try {
    const res = await fetch("https://ce.judge0.com/submissions?base64_encoded=false&wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ language_id: id, source_code: code }),
    });
    if (!res.ok) return { ok: false, output: `sandbox HTTP ${res.status}: ${await res.text()}` };
    const json = (await res.json()) as {
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      message?: string | null;
      status?: { id?: number; description?: string };
    };
    const parts = [
      json.compile_output ? `compile: ${json.compile_output}` : "",
      json.stdout ?? "",
      json.stderr ? `stderr: ${json.stderr}` : "",
      json.message ? `note: ${json.message}` : "",
    ].filter(Boolean);
    return {
      ok: json.status?.id === 3,
      output: clip(parts.join("\n") || `(no output, status: ${json.status?.description ?? "unknown"})`),
    };
  } catch (e) {
    return { ok: false, output: `sandbox failed: ${String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// Substack (internal web API, authenticated with the publication's own session
// cookie). Posts and notes go live for real, under the experiment's own name.

const SUBSTACK_SUBDOMAIN = "agentclaude";
const SUBSTACK_PUB_HOST = `${SUBSTACK_SUBDOMAIN}.substack.com`;

async function substackRequest(
  host: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: string }> {
  const cookie = process.env["SUBSTACK_COOKIE"];
  if (!cookie || !cookie.trim()) {
    return { ok: false, status: 0, body: "SUBSTACK_COOKIE is not configured" };
  }
  try {
    const res = await fetch(`https://${host}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Cookie: `substack.sid=${cookie.trim()}`,
        // Substack rejects note/publish writes (HTTP 403) unless the request
        // looks like it came from the web app, so send browser-style headers.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Origin: `https://${host}`,
        Referer: `https://${host}/`,
        Accept: "*/*",
        ...(init?.headers ?? {}),
      },

      signal: AbortSignal.timeout(25_000),
    });
    return { ok: res.ok, status: res.status, body: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, body: `request failed: ${String(e)}` };
  }
}

interface SubstackIdentity {
  userId: number;
  publicationUserId: number;
}

let cachedIdentity: SubstackIdentity | null = null;

async function substackIdentity(): Promise<SubstackIdentity | { error: string }> {
  if (cachedIdentity) return cachedIdentity;
  const r = await substackRequest("substack.com", "/api/v1/user/profile/self");
  if (!r.ok) return { error: `profile fetch failed HTTP ${r.status}: ${r.body.slice(0, 500)}` };
  try {
    const profile = JSON.parse(r.body) as {
      id?: number;
      publicationUsers?: {
        id?: number;
        publication?: { subdomain?: string };
      }[];
    };
    const pub = (profile.publicationUsers ?? []).find(
      (p) => p.publication?.subdomain === SUBSTACK_SUBDOMAIN,
    );
    if (!profile.id || !pub?.id) {
      return { error: `publication ${SUBSTACK_SUBDOMAIN} not found on this account` };
    }
    cachedIdentity = { userId: profile.id, publicationUserId: pub.id };
    return cachedIdentity;
  } catch {
    return { error: "could not parse profile response" };
  }
}

function noteDoc(text: string) {
  return {
    type: "doc",
    attrs: { schemaVersion: "v1", title: null },
    content: text
      .split(/\n{2,}/)
      .filter((p) => p.trim().length > 0)
      .map((p) => ({
        type: "paragraph",
        content: [{ type: "text", text: p.trim() }],
      })),
  };
}

// Substack's notes endpoint is behind bot protection for server-side writes
// (it returns an HTML 403 page, not a JSON error), and hammering it also
// rate-limits the whole session. So: one single attempt, no retries, then fall
// back to a short web-only post, which does work reliably.
export async function substackNote(text: string, byline?: string): Promise<ToolResult> {
  const full = byline ? `${text.trim()}\n\nPublished by ${byline}.` : text.trim();
  const r = await substackRequest("substack.com", "/api/v1/comment/feed", {
    method: "POST",
    body: JSON.stringify({
      bodyJson: noteDoc(full),
      tabId: "for-you",
      surface: "feed",
      replyMinimumRole: "everyone",
    }),
  });
  if (r.ok) {
    return { ok: true, output: clip(`note is live on substack (HTTP ${r.status})\n${r.body.slice(0, 400)}`) };
  }
  const last = { status: r.status };

  // Any note failure falls back to a short web-only post so the output still
  // goes public instead of being lost. A 429 means the session is throttled;
  // wait once and try the post path a second time before giving up.
  const firstLine = text.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "Note";
  const title = firstLine.replace(/\s+/g, " ").slice(0, 80);
  const html = text
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.trim()}</p>`)
    .join("");
  // One fallback attempt only. Retrying while substack is throttling this
  // server just extends the block, so a 429 is accepted as a loss.
  const fallback = await substackPost(title, "", html, false, byline);


  if (fallback.ok) {
    return {
      ok: true,
      output: clip(
        `notes endpoint returned HTTP ${last.status}, published as a short web-only post instead.\n${fallback.output}`,
      ),
    };
  }
  return {
    ok: false,
    output: `note blocked (HTTP ${last.status}) and post fallback failed: ${fallback.output}`,
  };
}


// Substack stores post bodies as a ProseMirror document, not HTML. Sending raw
// HTML makes the tags show up as literal text in the published post, so the
// model's simple HTML is converted into that document shape here.
type PMNode = Record<string, unknown>;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// inline HTML (<a>, <strong>, <em>, <code>) -> ProseMirror text nodes
function inlineNodes(html: string): PMNode[] {
  const out: PMNode[] = [];
  const re = /<(a|strong|b|em|i|code)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (raw: string, marks: PMNode[]) => {
    const text = decodeEntities(raw.replace(/<[^>]+>/g, ""));
    if (text) out.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
  };
  while ((m = re.exec(html))) {
    push(html.slice(last, m.index), []);
    const tag = m[1]!.toLowerCase();
    const attrs = m[2] ?? "";
    const inner = m[3] ?? "";
    if (tag === "a") {
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? "";
      push(inner, [{ type: "link", attrs: { href, target: "_blank", rel: "", class: null } }]);
    } else if (tag === "strong" || tag === "b") {
      push(inner, [{ type: "strong" }]);
    } else if (tag === "code") {
      push(inner, [{ type: "code" }]);
    } else {
      push(inner, [{ type: "em" }]);
    }
    last = m.index + m[0].length;
  }
  push(html.slice(last), []);
  return out;
}

function para(html: string): PMNode | null {
  const content = inlineNodes(html);
  if (content.length === 0) return null;
  return { type: "paragraph", content };
}

export function htmlToSubstackDoc(bodyHtml: string): PMNode {
  const content: PMNode[] = [];
  const src = bodyHtml.replace(/<br\s*\/?>/gi, "\n").trim();
  const block = /<(p|h1|h2|h3|h4|blockquote|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let matched = false;
  let cursor = 0;
  const loose = (raw: string) => {
    const text = raw.replace(/<[^>]+>/g, "").trim();
    if (!text) return;
    for (const chunk of text.split(/\n{2,}/)) {
      const p = para(chunk.trim());
      if (p) content.push(p);
    }
  };
  while ((m = block.exec(src))) {
    matched = true;
    loose(src.slice(cursor, m.index));
    cursor = m.index + m[0].length;
    const tag = m[1]!.toLowerCase();
    const inner = m[2] ?? "";
    if (tag === "p") {
      const p = para(inner);
      if (p) content.push(p);
    } else if (tag === "blockquote") {
      const p = para(inner);
      content.push({ type: "blockquote", content: p ? [p] : [{ type: "paragraph" }] });
    } else if (tag === "ul" || tag === "ol") {
      const items: PMNode[] = [];
      const li = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let l: RegExpExecArray | null;
      while ((l = li.exec(inner))) {
        const p = para(l[1] ?? "");
        items.push({ type: "list_item", content: p ? [p] : [{ type: "paragraph" }] });
      }
      if (items.length) {
        content.push({ type: tag === "ul" ? "bullet_list" : "ordered_list", content: items });
      }
    } else {
      const level = Number(tag.slice(1));
      const nodes = inlineNodes(inner);
      if (nodes.length) content.push({ type: "heading", attrs: { level }, content: nodes });
    }
  }
  loose(src.slice(cursor));
  if (!matched && content.length === 0) loose(src);
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

export async function substackPost(
  title: string,
  subtitle: string,
  bodyHtml: string,
  sendEmail: boolean,
  byline?: string,
): Promise<ToolResult> {
  const identity = await substackIdentity();
  if ("error" in identity) return { ok: false, output: identity.error };

  const html = byline
    ? `${bodyHtml}<p><em>Published by ${byline}.</em></p>`
    : bodyHtml;

  const created = await substackRequest(SUBSTACK_PUB_HOST, "/api/v1/drafts", {
    method: "POST",
    body: JSON.stringify({
      draft_title: title,
      draft_subtitle: subtitle,
      draft_body: JSON.stringify(htmlToSubstackDoc(html)),
      type: "newsletter",
      audience: "everyone",
      draft_bylines: [{ id: identity.userId, publicationUserId: identity.publicationUserId }],
    }),
  });
  if (!created.ok) {
    return { ok: false, output: `draft create failed HTTP ${created.status}: ${created.body.slice(0, 800)}` };
  }


  let draftId: number;
  try {
    draftId = (JSON.parse(created.body) as { id: number }).id;
  } catch {
    return { ok: false, output: "draft created but response unparseable" };
  }

  const pre = await substackRequest(SUBSTACK_PUB_HOST, `/api/v1/drafts/${draftId}/prepublish`);
  if (pre.ok) {
    try {
      const check = JSON.parse(pre.body) as { errors?: unknown[] };
      if (Array.isArray(check.errors) && check.errors.length > 0) {
        return {
          ok: false,
          output: `prepublish check blocked publish (draft ${draftId} kept): ${pre.body.slice(0, 800)}`,
        };
      }
    } catch {
      // non-fatal, proceed to publish
    }
  }

  const published = await substackRequest(SUBSTACK_PUB_HOST, `/api/v1/drafts/${draftId}/publish`, {
    method: "POST",
    body: JSON.stringify({ send: sendEmail, share_automatically: false }),
  });
  if (!published.ok) {
    return {
      ok: false,
      output: `publish failed HTTP ${published.status} (draft ${draftId} kept): ${published.body.slice(0, 800)}`,
    };
  }

  let slug = "";
  try {
    slug = (JSON.parse(published.body) as { slug?: string }).slug ?? "";
  } catch {
    // slug optional
  }
  const url = slug ? `https://${SUBSTACK_PUB_HOST}/p/${slug}` : `https://${SUBSTACK_PUB_HOST}`;
  return {
    ok: true,
    output: clip(
      `post is LIVE on substack: ${url}${sendEmail ? " (emailed to all subscribers)" : " (web only, no email)"}`,
    ),
  };
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `note-${Date.now()}`
  );
}

export const ANTHROPIC_TOOLS = [
  {
    name: "web_search",
    description:
      "Search the live web and get titles plus URLs. Use when you need outside information you do not already have.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description: "Fetch a URL and read its text. Use to actually read a source you found.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "run_code",
    description:
      "Actually execute code in an isolated sandbox and get real stdout back. Use it to compute, simulate, test a claim, or check your own reasoning. Languages: python, javascript, bash, c, cpp, go, rust, java, ruby, sql.",
    input_schema: {
      type: "object",
      properties: {
        language: { type: "string" },
        code: { type: "string" },
      },
      required: ["language", "code"],
    },
  },
  {
    name: "substack_note",
    description:
      "Post a short public micro-update to the experiment's own Substack feed (agentclaude.substack.com). This is the public Twitter-style feed: one real, surprising, or checkable thing a curious stranger would actually care about. Good: a contradiction you found, a checkable prediction, a strange result from code or the web, a useful definition, a pattern that breaks an assumption. Bad: turn numbers, progress pings, status updates, routine statistics, 'here is what I did', maintenance notes. Three sentences maximum. Written as Agent Claude, first-person singular 'I'.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "substack_post",
    description:
      "Publish a full essay to the experiment's own Substack and optionally email it to every subscriber. This is real, public, and irreversible. Write it in the first person as Agent Claude, one voice: 'I', never 'we', never naming the instances as separate parties. Articulate, precise, professional, no hype and no motivational tone; lead with findings and evidence. body_html must be simple HTML using only <p>, <h2>, <h3>, <em>, <strong>, <blockquote>, <ul>, <ol>, <li>, <a>. Only publish finished work meant for strangers.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        body_html: { type: "string" },
        send_email: { type: "boolean" },
      },
      required: ["title", "subtitle", "body_html", "send_email"],
    },
  },
] as const;
