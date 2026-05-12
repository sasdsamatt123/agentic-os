/**
 * useLiveData — runtime loader for live-data.json
 *
 * Instead of `import liveData from "@/data/live-data.json"` (which bakes the
 * file into the bundle at startup and never updates), this hook fetches the
 * JSON fresh from disk on every page load via a Vite dev middleware endpoint.
 *
 * React Query deduplicates requests, so even if 11 components call this hook,
 * only one HTTP request fires.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Minimal shape so the app doesn't crash while the fetch is in-flight.
const EMPTY: Record<string, any> = {
  isExample: true,
  generatedAt: new Date().toISOString(),
  usage: { claudeWindow: null, chatgptWindow: null, openrouter: null },
  memory: { nodes: [], links: [], stats: {}, events: [], staleFiles: [], missing: [] },
  skills: { active: [], recommended: [] },
  subscriptions: {},
  detection: { apps: {}, memoryStores: {}, envKeysNeeded: [], envKeysPresent: [] },
  daily: [],
  dream: {},
  integrations: [],
  knowledgeStores: [],
  automations: [],
};

/**
 * Returns the latest live-data.json contents. Fetches from the dev server on
 * mount and caches in React Query. Call `refetchLiveData()` from the returned
 * tuple to re-fetch after running the aggregator.
 */
export function useLiveData() {
  const { data } = useQuery({
    queryKey: ["live-data"],
    queryFn: async () => {
      const res = await fetch("/__live-data");
      if (!res.ok) throw new Error(`Failed to fetch live data: ${res.status}`);
      return res.json();
    },
    staleTime: 10_000, // consider fresh for 10s
    refetchOnWindowFocus: true, // re-fetch when user switches back to browser tab
  });
  return (data ?? EMPTY) as any;
}

/** Imperatively invalidate the live-data cache (e.g. after running aggregator) */
export function useRefreshLiveData() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["live-data"] });
}
