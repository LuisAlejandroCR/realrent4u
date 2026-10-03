// build-data.ts: build-time readers (server only) over public/data/, as written by scripts/copy-data.mjs:
// the address list behind /a/[id] and the method note (docs/METHOD.md) rendered to HTML for /method.

import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import type { Address } from "./types";

const DATA = path.join(process.cwd(), "public", "data");
// Relative links in docs/METHOD.md point at repo files; on the site they resolve to the repo on GitHub.
const REPO_DOCS = "https://github.com/LuisAlejandroCR/realrent4u/blob/main/docs/";

let addressCache: Address[] | null = null;

export function readAddresses(): Address[] {
  if (addressCache) return addressCache;
  try {
    const rows: unknown = JSON.parse(fs.readFileSync(path.join(DATA, "addresses.json"), "utf8"));
    addressCache = Array.isArray(rows) ? rows.filter((r): r is Address => typeof r?.address_id === "string" && r.address_id !== "") : [];
  } catch {
    addressCache = [];
  }
  return addressCache;
}

function resolveHref(href: string): string {
  if (/^\s*(javascript|vbscript|data):/i.test(href)) return "#";
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return href;
  return new URL(href, REPO_DOCS).href;
}

// Returns the method note as HTML, or null when docs/METHOD.md is not in this build. Raw HTML in the
// Markdown (e.g. the header comment every .md file carries) is dropped, not passed through.
export function readMethodNote(): string | null {
  let md: string;
  try {
    md = fs.readFileSync(path.join(DATA, "METHOD.md"), "utf8");
  } catch {
    return null;
  }
  if (!md.trim()) return null;
  const marked = new Marked({
    gfm: true,
    renderer: { html: () => "" },
    walkTokens(token) {
      if (token.type === "link" || token.type === "image") token.href = resolveHref(token.href);
    },
  });
  const html = marked.parse(md, { async: false });
  return html.trim() ? html : null;
}
