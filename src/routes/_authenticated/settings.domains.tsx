import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, Compass, Layers, ArrowRight, ChevronRight, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Pill } from "@/components/primitives/Pill";
import { DomainDetailSheet } from "@/components/knowledge/DomainDetailSheet";
import {
  listDomains,
  addDomain,
  deleteDomain,
  setDefaultDomain,
} from "@/lib/settings/settings.functions";
import { countEntriesByDomain } from "@/lib/knowledge/knowledge.functions";

export const Route = createFileRoute("/_authenticated/settings/domains")({
  component: DomainsSettings,
});

const SUGGESTIONS = [
  "Product",
  "Founder life",
  "AI",
  "Design",
  "Marketing",
  "Engineering",
  "Sales",
  "Community",
  "Leadership",
  "Storytelling",
  "Fitness",
  "Parenting",
  "Music",
  "Travel",
];

type Domain = { id: string; name: string; created_at?: string };

function DomainsSettings() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDomains);
  const addFn = useServerFn(addDomain);
  const delFn = useServerFn(deleteDomain);
  const countsFn = useServerFn(countEntriesByDomain);

  const { data: domains = [] } = useQuery({
    queryKey: ["settings", "domains"],
    queryFn: () => listFn() as Promise<Domain[]>,
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["settings", "domain-counts"],
    queryFn: () => countsFn() as Promise<Record<string, number>>,
  });

  const [openDomain, setOpenDomain] = useState<Domain | null>(null);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (n: string) => addFn({ data: { name: n } }),
    onSuccess: () => {
      setName("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["settings", "domains"] });
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Could not add domain"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "domains"] }),
  });

  const existing = new Set(domains.map((d) => d.name.toLowerCase()));
  const available = SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()));

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (existing.has(trimmed.toLowerCase())) {
      setError("You already have that domain.");
      return;
    }
    add.mutate(trimmed);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <SettingsPageHeader
        title="Domains"
        description="The areas of professional and personal passion and expertise you draw on for content. Domains become nodes in your Brain and steer what Eve pulls from your Curriculum Vitae."
      />

      <Link
        to="/settings/presets"
        className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-surface-elev"
      >
        <Layers className="h-4 w-4 text-accent" />
        <div className="flex-1">
          <div className="font-medium text-foreground">Presets</div>
          <div className="text-xs text-muted-foreground">
            Bundle domains, audience and voice into a reusable content lens
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>


      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Add a domain
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(name);
          }}
          className="flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={40}
            placeholder="e.g. Product-led growth, Endurance sports"
            className="flex-1 rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!name.trim() || add.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Short phrases work best — a couple of words that name the space.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your domains
        </h2>
        {domains.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-elev p-8 text-center text-sm text-muted-foreground">
            No domains yet. Add one above or tap a suggestion below.
          </div>
        ) : (
          <ul className="space-y-2">
            {domains.map((d) => {
              const count = counts[d.id] ?? 0;
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card pr-2"
                >
                  <button
                    type="button"
                    onClick={() => setOpenDomain(d)}
                    className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-elev"
                  >
                    <Compass className="h-4 w-4 text-accent" />
                    <span className="flex-1 text-sm text-foreground">{d.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {count === 0 ? "Add sources" : `${count} source${count === 1 ? "" : "s"}`}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(d.id)}
                    aria-label={`Remove ${d.name}`}
                    className="rounded-md p-1 text-muted-foreground hover:bg-surface-elev hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {available.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suggestions
          </h2>
          <div className="flex flex-wrap gap-2">
            {available.map((s) => (
              <Pill
                key={s}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => submit(s)}
              >
                + {s}
              </Pill>
            ))}
          </div>
        </section>
      )}
      <DomainDetailSheet
        open={!!openDomain}
        onOpenChange={(v) => !v && setOpenDomain(null)}
        domainId={openDomain?.id ?? null}
        domainName={openDomain?.name ?? ""}
      />
    </div>
  );
}
