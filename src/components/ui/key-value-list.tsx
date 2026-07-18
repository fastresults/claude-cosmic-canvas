import { Fragment } from "react";

/**
 * Renders any JSON-shaped value as a human-readable definition list.
 * Enforces the global rule: no raw JSON shown to users.
 */
export function KeyValueList({ data, empty = "Nothing to show." }: { data: unknown; empty?: string }) {
  if (data == null) return <p className="text-xs text-muted-foreground">{empty}</p>;
  if (typeof data !== "object") return <p className="text-xs text-foreground">{String(data)}</p>;

  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i + 1), v] as const)
    : Object.entries(data as Record<string, unknown>);

  if (entries.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;

  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-xs">
      {entries.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="font-medium text-muted-foreground capitalize">{humanize(k)}</dt>
          <dd className="text-foreground">{renderValue(v)}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function humanize(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(v: unknown): React.ReactNode {
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" || typeof v === "string") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">None</span>;
    if (v.every((x) => typeof x === "string" || typeof x === "number")) return v.join(", ");
    return (
      <ul className="list-disc pl-4">
        {v.map((item, i) => (
          <li key={i}>{renderValue(item)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="ml-2 border-l border-border pl-2">
      <KeyValueList data={v} />
    </div>
  );
}
