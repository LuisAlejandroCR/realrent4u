"use client";
// stamps.ts: the five exploration stamps of the "Start here" roadmap, as on mobile (find, mismatch, source, time,
// scenario). Session-only (sessionStorage, guarded); nothing leaves the browser. earn() is idempotent.
import { useEffect, useState } from "react";

export const STAMPS = ["find", "mismatch", "source", "time", "scenario"] as const;
export type StampId = (typeof STAMPS)[number];

const KEY = "rr-stamps";
let earned: StampId[] = [];
let last: StampId | null = null;
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(v)) earned = STAMPS.filter((s) => v.includes(s));
  } catch {
    earned = [];
  }
}

export function earn(id: StampId) {
  load();
  if (earned.includes(id)) return;
  earned = STAMPS.filter((s) => s === id || earned.includes(s));
  last = id;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(earned));
  } catch {
    /* storage blocked: stamps still work for this page view */
  }
  subs.forEach((f) => f());
}

export function clearLast() {
  last = null;
  subs.forEach((f) => f());
}

export function useStamps() {
  const [, tick] = useState(0);
  useEffect(() => {
    load();
    const f = () => tick((n) => n + 1);
    subs.add(f);
    f();
    return () => {
      subs.delete(f);
    };
  }, []);
  return { stamps: earned, last };
}
