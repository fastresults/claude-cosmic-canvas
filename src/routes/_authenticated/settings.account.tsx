import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { getMyProfile, updateMyProfile } from "@/lib/settings/settings.functions";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/account")({
  component: Account,
});

function Account() {
  const getProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile?.display_name]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const save = useMutation({
    mutationFn: () => updateProfile({ data: { display_name: name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsPageHeader
        title="Account"
        description="Your identity across Eve. Only your display name is used in prompts."
      />

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
            Display name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
            Email
          </span>
          <input
            value={email}
            readOnly
            className="w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm text-muted-foreground outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={save.isPending || !name.trim() || name === (profile?.display_name ?? "")}
            onClick={() => save.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
          {save.isSuccess && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>
      </section>

      <button
        onClick={signOut}
        className="mt-6 flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-5 w-5 text-destructive" />
        <span className="text-sm font-medium text-destructive">Sign out</span>
      </button>
    </div>
  );
}
