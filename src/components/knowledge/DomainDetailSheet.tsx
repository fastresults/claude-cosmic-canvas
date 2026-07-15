import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EveSheet } from "@/components/primitives/EveSheet";
import { CaptureFab, type CaptureAction } from "@/components/knowledge/CaptureFab";
import { SpeakSheet } from "@/components/knowledge/capture/SpeakSheet";
import { EntryCard } from "@/components/knowledge/EntryCard";
import { EntryDetailSheet } from "@/components/knowledge/EntryDetailSheet";
import { IngestionStatusStrip } from "@/components/knowledge/IngestionStatusStrip";
import { DomainIngestZone } from "@/components/knowledge/DomainIngestZone";
import type { KnowledgeEntry } from "@/components/knowledge/shared";
import {
  listEntries,
  pinEntry,
  archiveEntry,
} from "@/lib/knowledge/knowledge.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  domainId: string | null;
  domainName: string;
};

export function DomainDetailSheet({ open, onOpenChange, domainId, domainName }: Props) {
  const qc = useQueryClient();
  const [action, setAction] = useState<CaptureAction | null>(null);
  const [detail, setDetail] = useState<KnowledgeEntry | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const listEntriesFn = useServerFn(listEntries);
  const { data: entries = [] } = useQuery({
    queryKey: ["knowledge", "entries", "domain", domainId],
    enabled: !!domainId && open,
    queryFn: () =>
      listEntriesFn({
        data: { domain_id: domainId, include_archived: false },
      }) as Promise<KnowledgeEntry[]>,
  });

  const pinFn = useServerFn(pinEntry);
  const archiveFn = useServerFn(archiveEntry);
  const pin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => pinFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge", "entries"] }),
  });
  const arch = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id, archived: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      qc.invalidateQueries({ queryKey: ["settings", "domain-counts"] });
    },
  });

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title={domainName}>
      <div className="pb-32">
        <p className="mb-3 text-sm text-muted-foreground">
          Evidence that grounds Eve when writing about {domainName}. Add white papers,
          research, board memos, articles, links, or voice notes.
        </p>

        <IngestionStatusStrip userId={userId} />

        <div className="mt-3">
          <DomainIngestZone domainId={domainId} domainName={domainName} />
        </div>

        <div className="mt-3 space-y-2">
          {entries.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-surface-elev p-8 text-center text-sm text-muted-foreground">
              No sources yet. Tap <span className="text-accent">+</span> to add a
              white paper, research doc, board memo, article, link, or voice note.
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
          profileId={null}
          domainId={domainId}
        />
        <UrlSheet
          open={action === "url"}
          onOpenChange={(v) => !v && setAction(null)}
          profileId={null}
          domainId={domainId}
        />
        <UploadSheet
          open={action === "upload"}
          onOpenChange={(v) => !v && setAction(null)}
          profileId={null}
          domainId={domainId}
        />
        <LinkedInSheet
          open={action === "linkedin"}
          onOpenChange={(v) => !v && setAction(null)}
          profileId={null}
          domainId={domainId}
        />
        <SpeakSheet
          open={action === "speak"}
          onOpenChange={(v) => !v && setAction(null)}
          profileId={null}
          domainId={domainId}
        />

        <EntryDetailSheet entry={detail} onOpenChange={(v) => !v && setDetail(null)} />
      </div>
    </EveSheet>
  );
}
