import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { deleteChannel, listChannels } from "@/lib/settings/settings.functions";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/distribution")({
  component: Distribution,
});

const AVAILABLE = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X / Twitter" },
  { id: "email", label: "Email newsletter" },
] as const;

function Distribution() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const listFn = useServerFn(listChannels);
  const deleteFn = useServerFn(deleteChannel);

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => listFn(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsPageHeader
        title="Distribution"
        description="Where Eve publishes on your behalf. OAuth connections are coming soon."
      />

      <ul className="space-y-2">
        {AVAILABLE.map((ch) => {
          const connected = channels.find((c) => c.channel === ch.id);
          return (
            <li
              key={ch.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{ch.label}</div>
                <div className="text-xs text-muted-foreground">
                  {connected
                    ? connected.handle
                      ? `Connected as ${connected.handle}`
                      : "Connected"
                    : "Not connected · coming soon"}
                </div>
              </div>
              {connected ? (
                <button
                  type="button"
                  aria-label="Disconnect"
                  onClick={async () => {
                    if (await confirm({ title: `Disconnect ${ch.label}?`, destructive: true, confirmLabel: "Disconnect" })) remove.mutate(connected.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-md border border-border bg-surface-elev px-3 py-1.5 text-xs text-muted-foreground opacity-60"
                >
                  Connect
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
