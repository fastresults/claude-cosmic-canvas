import { Drawer } from "vaul";
import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type EveSheetProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  children: ReactNode;
};

/**
 * Single secondary-surface primitive: bottom drawer on phones,
 * centered dialog from tablet width up. Same API for every caller.
 */
export function EveSheet({ open, onOpenChange, title, children }: EveSheetProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85dvh] max-w-xl flex-col gap-0 overflow-hidden bg-surface p-0">
          {title ? (
            <DialogTitle className="px-6 pt-6 font-display text-xl text-foreground">{title}</DialogTitle>
          ) : (
            <DialogTitle className="sr-only">Details</DialogTitle>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

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
