import { useState, useCallback } from "react";

const LS_KEY = "claude-os-price-overrides";

export interface PriceOverrides {
  [slug: string]: number; // slug → monthly price
}

function loadOverrides(): PriceOverrides {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(o: PriceOverrides) {
  localStorage.setItem(LS_KEY, JSON.stringify(o));
}

/**
 * Hook to manage user-editable subscription prices.
 * Prices detected by the aggregator can be overridden by the user
 * and stored in localStorage. The override persists across page reloads
 * but doesn't pollute the git repo.
 */
export function usePriceOverrides() {
  const [overrides, setOverrides] = useState<PriceOverrides>(loadOverrides);

  const setPrice = useCallback((slug: string, price: number) => {
    setOverrides((prev) => {
      const next = { ...prev, [slug]: price };
      saveOverrides(next);
      return next;
    });
  }, []);

  /** Get the effective price: user override > aggregator default > null */
  const getPrice = useCallback(
    (slug: string, detectedPrice: number | null): number | null => {
      if (slug in overrides) return overrides[slug];
      return detectedPrice;
    },
    [overrides],
  );

  return { overrides, setPrice, getPrice };
}
