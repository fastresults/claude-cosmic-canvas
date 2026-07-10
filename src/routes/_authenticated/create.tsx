import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";

export const Route = createFileRoute("/_authenticated/create")({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
