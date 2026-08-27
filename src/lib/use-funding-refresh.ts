import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Re-reads the donation wallets and refreshes the page state so the life-line
// figure stays current while someone is watching.
export function useFundingRefresh(intervalMs = 30_000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        await fetch("/api/public/funding", { method: "POST" });
      } catch {
        return;
      }
      if (!cancelled) {
        void queryClient.invalidateQueries({ queryKey: ["experiment-state"] });
      }
    };

    void sync();
    const t = setInterval(() => void sync(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [queryClient, intervalMs]);
}
