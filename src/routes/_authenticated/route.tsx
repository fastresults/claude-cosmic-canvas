import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell/AppShell";
import { KeyboardShortcuts } from "@/components/shell/KeyboardShortcuts";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Onboarding gate — send new users to /onboarding on their first visit.
    if (location.pathname !== "/onboarding") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at, active_voice_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!profile?.onboarded_at) {
        throw redirect({ to: "/onboarding" });
      }

      // Pillar completion gate. Users can only reach content-producing surfaces
      // when Voice, Knowledge, Domain, and Audience are all set — in that order.
      // Allow-list settings, account maintenance, and legal so users can fix gaps.
      const path = location.pathname;
      const isAllowed =
        path.startsWith("/settings") ||
        path.startsWith("/auth") ||
        path === "/terms" ||
        path === "/privacy" ||
        path === "/onboarding";
      if (!isAllowed) {
        const uid = data.user.id;
        const [kp, dom, aud] = await Promise.all([
          supabase.from("knowledge_profiles").select("id").eq("user_id", uid).eq("is_default", true).maybeSingle(),
          supabase.from("domains").select("id").eq("user_id", uid).eq("is_default", true).maybeSingle(),
          supabase.from("audiences").select("id").eq("user_id", uid).eq("is_default", true).maybeSingle(),
        ]);
        const firstMissing: string | null = !profile.active_voice_id
          ? "voice"
          : !kp.data?.id
            ? "knowledge"
            : !dom.data?.id
              ? "domains"
              : !aud.data?.id
                ? "audiences"
                : null;
        if (firstMissing) {
          throw redirect({
            to: `/settings/${firstMissing}` as never,
            search: { setup: 1 } as never,
          });
        }
      }
    }

    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <KeyboardShortcuts />
      <Outlet />
    </AppShell>

  );
}
