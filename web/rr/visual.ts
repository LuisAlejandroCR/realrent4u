"use client";
// visual.ts: loads the precomputed map and chart data written by scripts/visual-data.mjs: metro maps
// (geo.json, addresses rounded to ~1 km) and result counts per address and date (address-dates.json).
import { useEffect, useState } from "react";
import type { LookupResult } from "./types";

export interface Metro {
  id: string;
  name: string;
  state: string;
  w: number;
  h: number;
  counties: { name: string; home: boolean; d: string }[];
  places: { jurisdiction: string; name: string; n: number; x: number; y: number }[];
  scale: { km: number; px: number };
}
export interface Geo {
  metros: Metro[];
  points: Record<string, { m: string; x: number; y: number; e: number }>;
  unplaced: string[];
}
export interface AddressDates {
  order: LookupResult[];
  dates: string[];
  /** Per address, one row per date: counts in `order`, then the conflict-flag count. */
  by: Record<string, number[][]>;
}

const cache = new Map<string, Promise<unknown>>();
function useJson<T>(name: string): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    if (!cache.has(name)) cache.set(name, fetch(`/data/${name}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    let live = true;
    cache.get(name)!.then((d) => live && setV(d as T | null));
    return () => {
      live = false;
    };
  }, [name]);
  return v;
}

export const useGeo = () => {
  const g = useJson<Geo>("geo.json");
  return g && g.metros?.length ? g : null;
};
export const useAddressDates = () => useJson<AddressDates>("address-dates.json");

/** The metro view that holds a jurisdiction (by its place label), if any. */
export function metroOf(geo: Geo, jurisdiction: string | null | undefined) {
  return geo.metros.find((m) => m.places.some((p) => p.jurisdiction === jurisdiction)) ?? null;
}
