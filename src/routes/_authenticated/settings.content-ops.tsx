import { createFileRoute } from "@tanstack/react-router";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

export const Route = createFileRoute("/_authenticated/settings/content-ops")({
  component: ContentOps,
});

function ContentOps() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsPageHeader
        title="Content Ops"
        description="Templates, presets, and tuning for how Eve drafts."
      />
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-foreground">Coming soon.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          For now, tune voice under Voice & Style and source material under Knowledge.
        </p>
      </div>
    </div>
  );
}
