import type { Link, Report } from "./cards";

/**
 * The sweep worker's report is model output: a field may be missing, null, a number where a string
 * was asked for, or "none" where nothing was found. This settles it into one shape for the deck.
 */

const NOTHING = /^\s*(none|null|n\/a|-)?\s*$/i;

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const asText = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : null;
  if (asText === null) return null;
  return NOTHING.test(asText) ? null : asText.trim();
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function links(value: unknown): Link[] {
  if (!Array.isArray(value)) return [];
  const read: Link[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { label, url, state } = entry as Record<string, unknown>;
    const href = text(url);
    if (!href || !/^https?:\/\//.test(href)) continue;
    read.push({ label: text(label) ?? href, url: href, state: text(state) });
  }
  return read;
}

export function normaliseReport(raw: unknown): Report | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    class: text(record.class),
    kind: text(record.kind),
    area: text(record.area),
    group: text(record.group),
    links: links(record.links),
    effortMin: number(record.effort_min),
    release: text(record.release),
    humanWords: text(record.human_words),
    since: text(record.since),
    ask: text(record.ask),
    recommend: text(record.recommend),
    evidence: text(record.evidence),
    rule: text(record.rule),
  };
}
