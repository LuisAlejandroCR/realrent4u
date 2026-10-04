"use client";
// hero.ts: loads /data/hero.json (written by scripts/copy-data.mjs): three real sample addresses with their
// lookup results on every precomputed date, so the landing stage can replay "address × date" without the
// ~6 MB per-date lookup files. Also the small motion helpers the landing shares (reveal, count-up).
import { useEffect, useRef, useState } from "react";
import type { LookupResult } from "./types";

export interface HeroItem { id: string; r: LookupResult; c: boolean }
export interface HeroAddress {
  kind: "dates" | "review" | "postal";
  address_id: string;
  street: string;
  postal_city: string;
  state: string;
  zip: string;
  year_built: string | null;
  units: string | null;
  jurisdiction: string;
  county: string | null;
  place: string | null;
  results: Record<string, HeroItem[]>;
  evidence: { id: string; quote: string; citation: string | null; url: string; retrieved_at: string | null } | null;
}
export interface HeroData {
  dates: string[];
  addresses: HeroAddress[];
  rules: Record<string, { title: string; level: string; jurisdiction: string; category: string }>;
}

/** undefined while loading, null when the build has no hero data (the stage is then not shown). */
export function useHero(): HeroData | null | undefined {
  const [h, setH] = useState<HeroData | null | undefined>(undefined);
  useEffect(() => {
    fetch("/data/hero.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HeroData | null) => setH(d && d.addresses?.length ? d : null))
      .catch(() => setH(null));
  }, []);
  return h;
}

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Adds `is-in` once the element scrolls into view (CSS does the motion; reduced motion shows it at once). */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Counts from 0 to `to` once visible. The final number is in the DOM from the start for assistive tech. */
export function useCountUp(to: number, ms = 1100) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) return;
    setN(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => (io.disconnect(), cancelAnimationFrame(raf));
  }, [to, ms]);
  return { ref, n };
}
