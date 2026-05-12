// Time-saved estimates per skill (minutes saved per invocation).
// Persisted in localStorage so the user can tune them across all projects.

import { useEffect, useState } from "react";
import { skills } from "@/lib/mock-data";

const STORAGE_KEY = "claude-os.time-saved.v1";
const RATE_KEY = "claude-os.hourly-rate.v1";

// All skills default to 0 minutes saved until the user explicitly
// configures a time estimate (or imports AI-generated estimates).
// No hardcoded guesses — the number should reflect real user experience.

export const DEFAULT_RATE = 120; // $/hour

export function getDefaultMinutes(_name: string) {
  return 0;
}

function loadMinutes(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadRate(): number {
  if (typeof window === "undefined") return DEFAULT_RATE;
  try {
    const raw = window.localStorage.getItem(RATE_KEY);
    return raw ? Number(raw) || DEFAULT_RATE : DEFAULT_RATE;
  } catch {
    return DEFAULT_RATE;
  }
}

export function useTimeSaved() {
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  const [rate, setRateState] = useState<number>(DEFAULT_RATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMinutes(loadMinutes());
    setRateState(loadRate());
    setHydrated(true);
  }, []);

  const minutesFor = (name: string) => minutes[name] ?? getDefaultMinutes(name);

  /** True if the user has explicitly set minutes for this skill */
  const isConfigured = (name: string) => name in minutes;

  const setMinutesFor = (name: string, value: number) => {
    const next = { ...minutes, [name]: Math.max(0, Math.round(value)) };
    setMinutes(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const setRate = (value: number) => {
    const v = Math.max(0, Math.round(value));
    setRateState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RATE_KEY, String(v));
    }
  };

  const resetAll = () => {
    setMinutes({});
    setRateState(DEFAULT_RATE);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(RATE_KEY);
    }
  };

  return { minutesFor, setMinutesFor, isConfigured, rate, setRate, resetAll, hydrated };
}

export type Period = "day" | "week" | "month";

// Derive runs in a given period from the 7d "uses" counter.
export function runsIn(uses7d: number, period: Period) {
  const perDay = uses7d / 7;
  if (period === "day") return perDay;
  if (period === "week") return uses7d;
  return perDay * 30;
}

export function formatHours(mins: number) {
  if (mins <= 0) return "0m";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function totals(minutesFor: (name: string) => number, rate: number, period: Period) {
  let mins = 0;
  for (const s of skills) {
    mins += minutesFor(s.name) * runsIn(s.uses, period);
  }
  return { minutes: mins, dollars: (mins / 60) * rate };
}
