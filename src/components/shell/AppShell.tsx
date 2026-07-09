import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { ComposerBar } from "./ComposerBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex-1 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-14">
        {children}
      </main>
      <ComposerBar />
      <BottomNav />
    </div>
  );
}
