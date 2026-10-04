"use client";
// landing.ts: loads /data/landing.json (written by scripts/landing-media.mjs from web/landing.config.json):
// the configured videos and demo link. Every field is null until the team provides the real resource.
import { useEffect, useState } from "react";

export interface LangPair { en: string | null; es: string | null }
export interface VideoConfig {
  id: string;
  title: { en: string; es: string };
  context: LangPair;
  optional: boolean;
  src: string | null;
  url: string | null;
  poster: string | null;
  duration: string | null;
  captions: LangPair;
  transcript: LangPair;
  qr_target: string | null;
  qr: string | null;
}
export interface LandingConfig {
  site_url: string | null;
  demo: { url: string | null; qr: string | null };
  downloads: { id: string; eyebrow: LangPair; title: LangPair; description: LangPair; url: string; qr: string | null }[];
  videos: VideoConfig[];
  warnings: string[];
}

const EMPTY: LandingConfig = { site_url: null, demo: { url: null, qr: null }, downloads: [], videos: [], warnings: [] };

export function useLandingConfig(): LandingConfig {
  const [cfg, setCfg] = useState<LandingConfig>(EMPTY);
  useEffect(() => {
    fetch("/data/landing.json")
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((c: LandingConfig) => setCfg({ ...EMPTY, ...c }))
      .catch(() => setCfg(EMPTY));
  }, []);
  return cfg;
}
