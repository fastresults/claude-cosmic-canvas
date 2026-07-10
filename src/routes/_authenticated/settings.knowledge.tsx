import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { listEntries, listProfiles } from "@/lib/knowledge/knowledge.functions";
import { ProfileSwitcherPill } from "@/components/knowledge/ProfileSwitcherPill";
import { CaptureFab, type CaptureAction } from "@/components/knowledge/CaptureFab";
import { PasteSheet } from "@/components/knowledge/capture/PasteSheet";
import { UrlSheet } from "@/components/knowledge/capture/UrlSheet";
import { UploadSheet } from "@/components/knowledge/capture/UploadSheet";
import { LinkedInSheet } from "@/components/knowledge/capture/LinkedInSheet";
import { SpeakSheet } from "@/components/knowledge/capture/SpeakSheet";
import { EntryCard } from "@/components/knowledge/EntryCard";
import { EntryDetailSheet } from "@/components/knowledge/EntryDetailSheet";
import { IngestionStatusStrip } from "@/components/knowledge/IngestionStatusStrip";
import { DesktopDropzone } from "@/components/knowledge/DesktopDropzone";
import {
  loadActiveProfileId,
  saveActiveProfileId,
  type KnowledgeEntry,
  type KnowledgeProfile,
} from "@/components/knowledge/shared";
import { pinEntry, archiveEntry } from "@/lib/knowledge/knowledge.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings/knowledge")({
  component: KnowledgeSettings,
});

function KnowledgeSettings() {
  const qc = useQueryClient();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [action, setAction] = useState<CaptureAction | null>(null);
  const [detail, setDetail] = useState<KnowledgeEntry | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setActiveProfileId(loadActiveProfileId());
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const listProfilesFn = useServerFn(listProfiles);
  const { data: profiles = [] } = useQuery({
    queryKey: ["knowledge", "profiles"],
    queryFn: () => listProfilesFn() as Promise<KnowledgeProfile[]>,
  });

  // Seed active profile to first profile if none stored
  useEffect(() => {
    if (!activeProfileId && profiles.length > 0) {
      setActiveProfileId(profiles[0].id);
      saveActiveProfileId(profiles[0].id);
    }
  }, [profiles, activeProfileId]);

  const listEntriesFn = useServerFn(listEntries);
  const { data: entries = [] } = useQuery({
    queryKey: ["knowledge", "entries", activeProfileId],
    queryFn: () =>
      listEntriesFn({ data: { profile_id: activeProfileId, include_archived: false } }) as Promise<
        KnowledgeEntry[]
      >,
  });

  const pinFn = useServerFn(pinEntry);
  const archiveFn = useServerFn(archiveEntry);
  const pin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => pinFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge", "entries"] }),
  });
  const arch = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id, archived: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge", "entries"] }),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <ProfileSwitcherPill activeId={activeProfileId} onChange={setActiveProfileId} />
        <IngestionStatusStrip userId={userId} />
      </div>

      <SettingsPageHeader
        title="Knowledge Base"
        description="Bios, past work, research, résumés. Every AI generation is grounded in what you save here — never invented."
      />

      <div className="mt-4 space-y-2">
        {entries.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface-elev p-8 text-center text-sm text-muted-foreground">
            No entries yet. Tap <span className="text-accent">+</span> to add your first bio, LinkedIn, résumé, or note.
          </div>
        )}
        {entries.map((e) => (
          <EntryCard
            key={e.id}
            entry={e}
            onTap={() => setDetail(e)}
            onPin={(pinned) => pin.mutate({ id: e.id, pinned })}
            onArchive={() => arch.mutate(e.id)}
          />
        ))}
      </div>

      <CaptureFab onPick={setAction} />

      <PasteSheet
        open={action === "paste"}
        onOpenChange={(v) => !v && setAction(null)}
        profileId={activeProfileId}
      />
      <UrlSheet
        open={action === "url"}
        onOpenChange={(v) => !v && setAction(null)}
        profileId={activeProfileId}
      />
      <UploadSheet
        open={action === "upload"}
        onOpenChange={(v) => !v && setAction(null)}
        profileId={activeProfileId}
      />
      <LinkedInSheet
        open={action === "linkedin"}
        onOpenChange={(v) => !v && setAction(null)}
        profileId={activeProfileId}
      />
      <SpeakSheet
        open={action === "speak"}
        onOpenChange={(v) => !v && setAction(null)}
        profileId={activeProfileId}
      />

      <EntryDetailSheet entry={detail} onOpenChange={(v) => !v && setDetail(null)} />
      <DesktopDropzone profileId={activeProfileId} />
    </div>
  );
}
