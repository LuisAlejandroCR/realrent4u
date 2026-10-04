"use client";
// AddressSearch.tsx: accessible combobox over the 500 sample addresses (ID, street, city, ZIP).
// "/" anywhere outside a text field focuses it (docs/DESIGN.md, keyboard rule).
import { useEffect, useId, useRef, useState } from "react";
import type { Address } from "../types";
import type { Dict } from "../i18n";
import { searchAddresses } from "../data";

export interface AddressSearchProps {
  addresses: Address[];
  onSelect: (a: Address) => void;
  tr: Dict;
}

/** Accessible combobox-style search over sample addresses (ID, street, city). */
export function AddressSearch({ addresses, onSelect, tr }: AddressSearchProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const hits = searchAddresses(addresses, q);
  const open = q.trim().length > 0;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (a: Address) => {
    onSelect(a);
    setQ("");
  };

  return (
    <div className="rr-search">
      <label htmlFor={`${id}-q`} className="rr-search-label">{tr.searchLabel}</label>
      <p id={`${id}-help`} className="rr-muted">{tr.searchHelp}</p>
      <input
        ref={input}
        id={`${id}-q`}
        aria-keyshortcuts="/"
        type="search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={`${id}-list`}
        aria-describedby={`${id}-help ${id}-count`}
        aria-activedescendant={open && hits[active] ? `${id}-o${active}` : undefined}
        autoComplete="off"
        placeholder={tr.searchPlaceholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && hits[active]) { e.preventDefault(); pick(hits[active]); }
          if (e.key === "Escape") setQ("");
        }}
      />
      <p id={`${id}-count`} className="rr-sr" aria-live="polite">{open ? tr.matches(hits.length) : ""}</p>
      {open && hits.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="rr-search-list">
          {hits.map((a, i) => (
            <li
              key={a.address_id}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(a); }}
            >
              <span className="rr-id">{a.address_id}</span>
              <span>{a.street_address}</span>
              <span className="rr-muted">{a.postal_city}, {a.state} {a.zip}</span>
            </li>
          ))}
        </ul>
      )}
      {open && hits.length === 0 && (
        <div className="rr-search-empty" role="status">
          <strong>{tr.noMatches}</strong>
          <p className="rr-muted">{tr.noMatchesHelp}</p>
        </div>
      )}
    </div>
  );
}
