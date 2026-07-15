import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { DefaultsStrip } from "@/components/settings/DefaultsStrip";
import { ComposerBar } from "./ComposerBar";
import {
  WorkingDraftProvider,
  useWorkingDraft,
} from "@/lib/content/working-draft";

function ShellComposer() {
  const { generate, busy } = useWorkingDraft();
  return <ComposerBar onGenerate={generate} busy={busy} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkingDraftProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <TopBar />
        <main className="flex-1 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-14">
          <DefaultsStrip />
          {children}
        </main>
        <ShellComposer />
        <BottomNav />
      </div>
    </WorkingDraftProvider>
  );
}
