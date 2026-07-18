import { EveSheet } from "@/components/primitives/EveSheet";
import { Pill } from "@/components/primitives/Pill";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProfile,
  listProfiles,
  renameKnowledgeProfile,
  setDefaultKnowledgeProfile,
} from "@/lib/knowledge/knowledge.functions";
import { ChevronDown, Plus, User, Briefcase, Megaphone, Star, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { KIND_LABELS, type KnowledgeProfile, saveActiveProfileId } from "./shared";

type Props = {
  activeId: string | null;
  onChange: (id: string | null) => void;
};

const KIND_ICON = {
  personal: User,
  client: Briefcase,
  campaign: Megaphone,
} as const;

export function ProfileSwitcherPill({ activeId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"personal" | "client" | "campaign">("client");

  const qc = useQueryClient();
  const listFn = useServerFn(listProfiles);
  const createFn = useServerFn(createProfile);

  const { data: profiles = [] } = useQuery({
    queryKey: ["knowledge", "profiles"],
    queryFn: () => listFn() as Promise<KnowledgeProfile[]>,
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { name: name.trim(), kind } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["knowledge", "profiles"] });
      onChange(row.id);
      saveActiveProfileId(row.id);
      setName("");
      setCreating(false);
    },
  });

  const setDefaultFn = useServerFn(setDefaultKnowledgeProfile);
  const setDefault = useMutation({
    mutationFn: (id: string) => setDefaultFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge", "profiles"] }),
  });

  const active = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
  const ActiveIcon = active ? KIND_ICON[active.kind as keyof typeof KIND_ICON] : User;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface-elev px-3 py-1.5 text-sm text-foreground"
      >
        <ActiveIcon className="h-4 w-4 text-accent" />
        <span className="max-w-[10rem] truncate">
          {active?.name ?? "Choose profile"}
        </span>
        {active && (
          <span className="text-xs text-muted-foreground">
            · {KIND_LABELS[active.kind] ?? active.kind}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <EveSheet open={open} onOpenChange={setOpen} title="Active profile">
        <div className="space-y-2">
          {profiles.map((p) => {
            const Icon = KIND_ICON[p.kind as keyof typeof KIND_ICON] ?? User;
            const isActive = p.id === activeId;
            const isDefault = (p as { is_default?: boolean }).is_default === true;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-lg border px-1 pr-2 transition-colors ${
                  isActive
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface hover:bg-surface-elev"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    saveActiveProfileId(p.id);
                    setOpen(false);
                  }}
                  className="flex flex-1 items-center gap-3 rounded-lg px-2 py-3 text-left"
                >
                  <Icon className="h-4 w-4 text-accent" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      {p.name}
                      {isDefault && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          <Star className="h-2.5 w-2.5" /> default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {KIND_LABELS[p.kind] ?? p.kind}
                    </div>
                  </div>
                </button>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault.mutate(p.id)}
                    disabled={setDefault.isPending}
                    className="inline-flex items-center gap-1 rounded-pill border border-accent/40 bg-surface px-2 py-1 text-[11px] font-display text-accent hover:bg-accent/10 disabled:opacity-50"
                    title="Make this the global default knowledge profile"
                    aria-pressed={false}
                    aria-label="Set as default profile"
                  >
                    <Star className="h-3 w-3" />
                    Set default
                  </button>
                )}
              </div>
            );
          })}

          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-surface-elev"
            >
              <Plus className="h-4 w-4" /> New profile
            </button>
          ) : (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-elev p-3">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Profile name"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                {(["personal", "client", "campaign"] as const).map((k) => (
                  <Pill
                    key={k}
                    size="sm"
                    variant={kind === k ? "solid" : "outline"}
                    onClick={() => setKind(k)}
                  >
                    {KIND_LABELS[k]}
                  </Pill>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || create.isPending}
                  onClick={() => create.mutate()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </div>
      </EveSheet>
    </>
  );
}
