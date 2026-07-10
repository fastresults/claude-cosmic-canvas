import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CREATE_FORMATS, CATEGORY_LABELS, formatsByCategory, type CreateCategory } from "@/config/createFormats";
import { FormatCard } from "@/components/create/FormatCard";
import { useRecentCreateDrafts } from "@/hooks/useRecentCreateDrafts";

export const Route = createFileRoute("/_authenticated/create/")({
  head: () => ({
    meta: [
      { title: "Create — Eve" },
      { name: "description", content: "40+ AI-first content formats, one hub. Voice, mobile, one thumb." },
    ],
  }),
  component: CreateHub,
});

function CreateHub() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CreateCategory | "all">("all");
  const { data: recent = [] } = useRecentCreateDrafts();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CREATE_FORMATS.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (!q) return true;
      return f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
    });
  }, [query, category]);

  const grouped = useMemo(() => {
    if (category !== "all") return [[category, filtered] as const];
    return formatsByCategory().map(([c, list]) => [c, list.filter((f) => filtered.includes(f))] as const);
  }, [filtered, category]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-24 pt-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-foreground">Create</h1>
        <p className="text-sm text-muted-foreground">Say one sentence. Pick a format. Eve drafts the rest.</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 40+ formats…"
          className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/60"
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex items-center gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>All</Chip>
          {(Object.keys(CATEGORY_LABELS) as CreateCategory[]).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Recent drafts</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.slice(0, 8).map((d) => (
              <Link
                key={d.id}
                to="/create/$formatId"
                params={{ formatId: d.format_id }}
                search={{ draftId: d.id }}
                className="min-w-[180px] max-w-[220px] shrink-0 rounded-2xl border border-border bg-surface p-3"
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.format_id}</div>
                <div className="mt-1 line-clamp-2 text-sm text-foreground">{d.title ?? "Untitled draft"}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {grouped.map(([c, list]) =>
        list.length === 0 ? null : (
          <section key={c}>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{CATEGORY_LABELS[c]}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {list.map((f) => (
                <FormatCard key={f.id} format={f} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-accent bg-accent/15 text-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
