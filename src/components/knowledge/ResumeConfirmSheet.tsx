import { useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ingestEntry } from "@/lib/knowledge/knowledge.functions";
import type { StructuredProfile } from "@/lib/knowledge/extract.functions";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  structured: StructuredProfile;
  markdown: string;
  sourceType: "linkedin" | "resume";
  title: string;
  sourceUrl: string | null;
  profileId: string | null;
  domainId?: string | null;
  onSaved: () => void;
};

export function ResumeConfirmSheet({
  open,
  onOpenChange,
  structured: initial,
  markdown,
  sourceType,
  title,
  sourceUrl,
  profileId,
  domainId,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const ingestFn = useServerFn(ingestEntry);
  const [profile, setProfile] = useState<StructuredProfile>(initial);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      // Serialize structured data into content for grounding
      const content = [
        profile.full_name && `# ${profile.full_name}`,
        profile.headline && `_${profile.headline}_`,
        profile.about,
        profile.roles.length &&
          `## Experience\n${profile.roles
            .map(
              (r) =>
                `- **${r.title}** at ${r.company} (${r.start ?? "?"} – ${r.end ?? "present"})${
                  r.summary ? `\n  ${r.summary}` : ""
                }`,
            )
            .join("\n")}`,
        profile.education.length &&
          `## Education\n${profile.education
            .map((e) => `- ${e.degree} ${e.field} — ${e.school} (${e.start ?? "?"} – ${e.end ?? "?"})`)
            .join("\n")}`,
        profile.skills.length && `## Skills\n${profile.skills.join(", ")}`,
        profile.achievements.length &&
          `## Achievements\n${profile.achievements.map((a) => `- ${a}`).join("\n")}`,
        `\n---\n${markdown.slice(0, 20000)}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      return ingestFn({
        data: {
          profile_id: profileId,
          domain_id: domainId ?? null,
          source_type: sourceType,
          title: profile.full_name || title,
          content,
          source_url: sourceUrl,
          tags: profile.skills.slice(0, 6),
          kind: sourceType,
          meta: { structured: profile },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      onSaved();
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="Confirm what we found">
      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Name</label>
          <input
            value={profile.full_name}
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Headline</label>
          <input
            value={profile.headline}
            onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Experience ({profile.roles.length})</h3>
          <div className="space-y-2">
            {profile.roles.map((r, i) => (
              <div key={i} className="rounded-md border border-border bg-surface-elev p-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.title || "Untitled role"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.company} · {r.start ?? "?"} – {r.end ?? "present"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setProfile({
                        ...profile,
                        roles: profile.roles.filter((_, j) => j !== i),
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {profile.roles.length === 0 && (
              <p className="text-xs text-muted-foreground">No roles detected.</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Skills ({profile.skills.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((s, i) => (
              <button
                key={`${s}-${i}`}
                type="button"
                onClick={() =>
                  setProfile({ ...profile, skills: profile.skills.filter((_, j) => j !== i) })
                }
                className="rounded-pill border border-border bg-surface-elev px-2.5 py-1 text-xs"
              >
                {s} ×
              </button>
            ))}
            {profile.skills.length === 0 && (
              <p className="text-xs text-muted-foreground">No skills detected.</p>
            )}
          </div>
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Confirm & save"}
          </button>
        </div>
      </div>
    </EveSheet>
  );
}
