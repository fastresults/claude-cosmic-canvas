import { Drawer } from "vaul";
import type { ReactNode } from "react";

type EveSheetProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  children: ReactNode;
};

/**
 * Single bottom-sheet primitive for every secondary surface.
 * Voice · Domain · Format · Channel · Schedule · Image · Node Peek · Provenance.
 */
export function EveSheet({ open, onOpenChange, title, children }: EveSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border" />
          {title && (
            <Drawer.Title className="px-5 pt-4 font-display text-xl text-foreground">
              {title}
            </Drawer.Title>
          )}
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
