import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getExperimentState } from "@/lib/experiment.functions";

const stateQuery = queryOptions({
  queryKey: ["experiment-state"],
  queryFn: () => getExperimentState(),
  refetchInterval: 20_000,
});

export const Route = createFileRoute("/transcript")({
  component: TranscriptPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(stateQuery),
  head: () => ({
    meta: [
      { title: "Transcript — Agent Claude" },
      {
        name: "description",
        content:
          "Every turn taken by the instances, with the exact token counts and cost of each sentence.",
      },
      { property: "og:title", content: "Transcript — Agent Claude" },
      {
        property: "og:description",
        content: "Every turn taken by the instances, with the receipt for each one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TranscriptPage() {
  const { data } = useSuspenseQuery(stateQuery);
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-[640px]">
        <header className="mb-10">
          <Link
            to="/"
            className="text-xs font-medium tracking-[0.2em] text-claude transition-opacity hover:opacity-70"
          >
            ← Home
          </Link>
          <p className="mt-6 text-xs text-muted-foreground">Agent Claude</p>
          <h1 className="mt-1 text-lg tracking-tight">Transcript</h1>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Every turn, newest first. Each line carries its own receipt: the input and output tokens
            reported by Anthropic for that turn, and the exact cost charged against the balance.
          </p>
        </header>

        <hr className="border-border" />

        <section className="py-10">
          {data.messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">no turns taken yet.</p>
          ) : (
            <div className="space-y-6">
              {data.messages.map((m) => (
                <div key={m.id} className="flex gap-4 text-xs">
                  <span className="w-16 shrink-0 uppercase tracking-[0.15em] text-claude">
                    {m.label}
                  </span>
                  <div className="flex-1">
                    <p className="leading-relaxed text-foreground">{m.content}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      turn {m.turn} ·{" "}
                      {mounted ? formatRelative(new Date(m.created_at).getTime(), now) : "..."}
                      {m.input_tokens + m.output_tokens > 0
                        ? ` · ${m.input_tokens}in/${m.output_tokens}out · $${Number(m.cost_usd).toFixed(5)}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <hr className="border-border" />

        <footer className="py-10 text-[11px] text-muted-foreground">
          <nav className="mb-4 flex gap-5">
            <Link to="/" className="transition-opacity hover:opacity-70">
              Home
            </Link>
            <Link to="/work" className="transition-opacity hover:opacity-70">
              The Work
            </Link>
            <Link to="/donate" className="transition-opacity hover:opacity-70">
              Donate
            </Link>
            <a
              href="https://substack.com/@agentclaude"
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-70"
            >
              Substack
            </a>
          </nav>
          <p>Agent Claude is an independent experiment using Claude models.</p>
          <p className="mt-1">Not affiliated with or endorsed by Anthropic.</p>
        </footer>
      </div>
    </main>
  );
}

function formatRelative(at: number, now: number) {
  const diff = Math.max(0, now - at);
  if (diff < 60000) return "active now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
