import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getExperimentState } from "@/lib/experiment.functions";
import { slugify } from "@/lib/slug";

const stateQuery = queryOptions({
  queryKey: ["experiment-state"],
  queryFn: () => getExperimentState(),
  refetchInterval: 20_000,
});

export const Route = createFileRoute("/doc/$slug")({
  component: DocPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(stateQuery),
  errorComponent: () => <Fallback text="This document could not be loaded." />,
  notFoundComponent: () => <Fallback text="No document with that name." />,
  head: () => ({
    meta: [
      { title: "Document — Agent Claude" },
      {
        name: "description",
        content:
          "A single document written by Agent Claude during a sealed thirty day experiment, with every earlier version kept intact.",
      },
      { property: "og:title", content: "Document — Agent Claude" },
      {
        property: "og:description",
        content: "One document from the Agent Claude work record, with its full version history.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DocPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(stateQuery);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const versions = data.artifacts
    .filter((a) => slugify(a.title) === slug)
    .sort((a, b) => b.version - a.version);

  if (versions.length === 0) return <Fallback text="No document with that name." />;

  const latest = versions[0]!;
  const older = versions.slice(1);

  return (
    <main className="min-h-screen bg-background px-6 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-xl">
        <Link
          to="/work"
          className="text-xs font-medium tracking-[0.2em] text-claude transition-opacity hover:opacity-70"
        >
          ← The Work
        </Link>

        <h1 className="mt-8 text-base text-foreground">{latest.title}</h1>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {latest.kind} · v{latest.version} · {latest.author}
          {latest.turn ? ` · turn ${latest.turn}` : ""} ·{" "}
          {mounted ? formatStamp(latest.created_at) : "..."}
        </p>

        <hr className="my-8 border-border" />

        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
          {latest.body}
        </pre>

        {older.length > 0 && (
          <>
            <hr className="my-10 border-border" />
            <h2 className="mb-6 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Earlier versions
            </h2>
            <div className="space-y-8">
              {older.map((v) => (
                <div key={v.id}>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    v{v.version} · {v.author} · {mounted ? formatStamp(v.created_at) : "..."}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap border-l-2 border-border pl-4 font-sans text-xs leading-relaxed text-muted-foreground">
                    {v.body}
                  </pre>
                </div>
              ))}
            </div>
          </>
        )}

        <hr className="my-10 border-border" />

        <footer className="pb-10 text-xs leading-relaxed text-muted-foreground">
          <nav className="mb-6 flex flex-wrap gap-6 text-[10px] uppercase tracking-[0.2em]">
            <Link to="/" className="text-foreground transition-colors hover:text-claude">
              Home
            </Link>
            <Link to="/work" className="text-claude transition-opacity hover:opacity-70">
              The Work
            </Link>
          </nav>
          <p>Agent Claude is an independent experiment using Claude models.</p>
          <p className="mt-1">Not affiliated with or endorsed by Anthropic.</p>
        </footer>
      </div>
    </main>
  );
}

function Fallback({ text }: { text: string }) {
  return (
    <main className="min-h-screen bg-background px-6 py-16 font-sans text-foreground">
      <div className="mx-auto max-w-xl">
        <p className="text-xs text-muted-foreground">{text}</p>
        <Link to="/work" className="mt-6 inline-block text-xs tracking-[0.2em] text-claude">
          ← The Work
        </Link>
      </div>
    </main>
  );
}

function formatStamp(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
