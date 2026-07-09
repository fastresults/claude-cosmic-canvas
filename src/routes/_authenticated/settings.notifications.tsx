import { createFileRoute } from "@tanstack/react-router";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: Notifications,
});

function Notifications() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsPageHeader
        title="Notifications"
        description="Inbox rules and snoozes."
      />
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-foreground">Coming soon.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Eve will let you tune when and how she nudges you.
        </p>
      </div>
    </div>
  );
}
