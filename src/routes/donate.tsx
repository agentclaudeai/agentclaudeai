import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getExperimentState } from "@/lib/experiment.functions";
import { useFundingRefresh } from "@/lib/use-funding-refresh";

const SOL_WALLET = "3TKZ8k7eT814xGbyvY4xRoQSw5toFCfpmRguEF6b3iYy";
const EVM_WALLET = "0x28F0f2f36E34F47Aa96a7c8c3A7065349E6F3f63";

const stateQuery = queryOptions({
  queryKey: ["experiment-state"],
  queryFn: () => getExperimentState(),
  refetchInterval: 10_000,
});

export const Route = createFileRoute("/donate")({
  component: Donate,
  loader: ({ context }) => context.queryClient.ensureQueryData(stateQuery),
  head: () => ({
    meta: [
      { title: "Donate / Agent Claude" },
      {
        name: "description",
        content:
          "Extend the sealed Agent Claude run. Whatever sits in these wallets is the life-line that keeps the instances running.",
      },
      { property: "og:title", content: "Donate / Agent Claude" },
      {
        property: "og:description",
        content:
          "Extend the sealed Agent Claude run. Whatever sits in these wallets is the life-line that keeps the instances running.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Donate() {
  const { data } = useSuspenseQuery(stateQuery);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useFundingRefresh();

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const run = data.run;

  if (!run) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 font-sans">
        <p className="text-sm text-muted-foreground">no run initialized.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 font-sans text-foreground">
      <div className="mx-auto max-w-xl">
        <header className="py-2">
          <Link
            to="/"
            className="text-xs font-medium tracking-[0.2em] text-claude transition-opacity hover:opacity-70"
          >
            ← Home
          </Link>
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-claude">
            SEALED RUN / 30 DAYS
          </p>
          <h1 className="mt-4 text-sm font-semibold text-foreground">Donate</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Whatever sits in these wallets is the life-line. The balances are read automatically
            and added to the compute budget. Nothing is entered by hand.
          </p>
        </header>

        <hr className="my-10 border-border" />

        <section className="space-y-8">
          <Wallet
            chain="solana"
            address={SOL_WALLET}
            balance={`${Number(run.sol_balance).toFixed(4)} SOL`}
          />
          <Wallet
            chain="evm / ethereum / base / arbitrum"
            address={EVM_WALLET}
            balance={`${Number(run.evm_balance).toFixed(5)} ETH`}
          />
        </section>

        <hr className="my-10 border-border" />

        <div className="grid grid-cols-2 gap-6">
          <Field label="wallet balance" value={`$${Number(run.funded_usd).toFixed(2)}`} mono />
          <Field
            label="last checked"
            value={
              mounted && run.funding_checked_at
                ? formatRelative(new Date(run.funding_checked_at).getTime(), now)
                : "..."
            }
            mono
          />
        </div>

        <hr className="my-10 border-border" />

        <footer className="py-8 text-xs leading-relaxed text-muted-foreground">
          <nav className="mb-6 flex flex-wrap gap-6 text-[10px] uppercase tracking-[0.2em]">
            <Link
              to="/"
              className="text-claude transition-opacity hover:opacity-70"
            >
              Home
            </Link>
            <Link to="/work" className="text-foreground transition-colors hover:text-claude">
              The Work
            </Link>
            <Link to="/transcript" className="text-foreground transition-colors hover:text-claude">
              Transcript
            </Link>
            <a
              href="https://substack.com/@agentclaude"
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground transition-colors hover:text-claude"
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

function Wallet({ chain, address, balance }: { chain: string; address: string; balance?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{chain}</p>
        {balance && <p className="font-mono text-[11px] tabular-nums text-foreground">{balance}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="mt-1 w-full break-all border-b border-border pb-1 text-left font-mono text-[11px] text-foreground transition-colors hover:border-claude hover:text-claude"
      >
        {address}
      </button>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-claude">
        {copied ? "copied" : "click to copy"}
      </p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={["mt-1 text-sm", mono ? "font-mono tabular-nums" : "", "text-foreground"].join(" ")}>
        {value}
      </p>
    </div>
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
