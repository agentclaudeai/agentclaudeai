import { createFileRoute } from "@tanstack/react-router";

// Reads the two donation wallets on-chain and writes their USD value onto the run.
// Public, read-only against external RPCs; only writes the funding figure.

const SOL_WALLET = "3TKZ8k7eT814xGbyvY4xRoQSw5toFCfpmRguEF6b3iYy";
const EVM_WALLET = "0x28F0f2f36E34F47Aa96a7c8c3A7065349E6F3f63";

const EVM_RPCS: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
};

async function solBalance(): Promise<number> {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [SOL_WALLET] }),
  });
  if (!res.ok) return 0;
  const json = (await res.json()) as { result?: { value?: number } };
  return (json.result?.value ?? 0) / 1e9;
}

async function evmBalance(rpc: string): Promise<number> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [EVM_WALLET, "latest"],
    }),
  });
  if (!res.ok) return 0;
  const json = (await res.json()) as { result?: string };
  if (!json.result) return 0;
  return Number(BigInt(json.result)) / 1e18;
}

async function prices(): Promise<{ sol: number; eth: number }> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum&vs_currencies=usd",
    );
    if (!res.ok) return { sol: 0, eth: 0 };
    const json = (await res.json()) as { solana?: { usd?: number }; ethereum?: { usd?: number } };
    return { sol: json.solana?.usd ?? 0, eth: json.ethereum?.usd ?? 0 };
  } catch {
    return { sol: 0, eth: 0 };
  }
}

export const Route = createFileRoute("/api/public/funding")({
  server: {
    handlers: {
      GET: async () => sync(),
      POST: async () => sync(),
    },
  },
});

async function sync(): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: run } = await supabaseAdmin
    .from("experiment_run")
    .select("id,funded_usd,initial_budget_usd")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!run) return Response.json({ ok: false, error: "no run" }, { status: 404 });

  const [sol, eth, base, arb, price] = await Promise.all([
    solBalance().catch(() => 0),
    evmBalance(EVM_RPCS["ethereum"]!).catch(() => 0),
    evmBalance(EVM_RPCS["base"]!).catch(() => 0),
    evmBalance(EVM_RPCS["arbitrum"]!).catch(() => 0),
    prices(),
  ]);

  const evmTotal = eth + base + arb;
  const onchainUsd = sol * price.sol + evmTotal * price.eth;
  const usd = Number(run.initial_budget_usd ?? 0) + onchainUsd;

  await supabaseAdmin
    .from("experiment_run")
    .update({
      funded_usd: Number(usd.toFixed(4)),
      funding_checked_at: new Date().toISOString(),
      sol_balance: Number(sol.toFixed(6)),
      evm_balance: Number(evmTotal.toFixed(8)),
    })
    .eq("id", run.id);

  return Response.json({ ok: true, sol, evm: evmTotal, usd });
}
