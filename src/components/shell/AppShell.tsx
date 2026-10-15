import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { DefaultsStrip } from "@/components/settings/DefaultsStrip";
import { SetupJourneyStrip } from "@/components/onboarding/SetupJourneyStrip";
import { ComposerBar } from "./ComposerBar";
import { VoiceScopeProvider } from "@/lib/voice/voice-scope";
import {
  WorkingDraftProvider,
  useWorkingDraft,
} from "@/lib/content/working-draft";
import { useUserDefaults } from "@/hooks/useUserDefaults";

function ShellComposer() {
  const { generate, busy } = useWorkingDraft();
  return <ComposerBar onGenerate={generate} busy={busy} />;
}

function ShellChrome({ children }: { children: ReactNode }) {
  const defaults = useUserDefaults();
  const location = useLocation();
  // Hide competing chrome while the user is still completing setup, and on
  // the onboarding surface itself.
  const setupIncomplete = !defaults.loading && !defaults.ready;
  const onOnboarding = location.pathname.startsWith("/onboarding");
  const hideChrome = setupIncomplete || onOnboarding;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar />
      {!onOnboarding && <DesktopSidebar gated={setupIncomplete} />}
      <main
        className={`flex-1 pt-14 ${onOnboarding ? "" : "lg:pl-60"} ${
          hideChrome
            ? "pb-[env(safe-area-inset-bottom)]"
            : "pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-32"
        }`}
      >
        <SetupJourneyStrip />
        {!hideChrome && <DefaultsStrip />}
        {children}
      </main>
      {!hideChrome && <ShellComposer />}
      {!onOnboarding && <BottomNav gated={setupIncomplete} />}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <VoiceScopeProvider>
      <WorkingDraftProvider>
        <ShellChrome>{children}</ShellChrome>
      </WorkingDraftProvider>
    </VoiceScopeProvider>
  );
}
