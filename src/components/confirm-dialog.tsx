import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Use `const confirm = useConfirm()` instead of window.confirm / window.alert
// so every "system prompt" renders through our themed AlertDialog.

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

const ConfirmContext = React.createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<Pending[]>([]);
  const current = queue[0];
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (current) setOpen(true);
  }, [current]);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setQueue((q) => [...q, { options, resolve }]);
    });
  }, []);

  const settle = (value: boolean) => {
    if (!current) return;
    current.resolve(value);
    setOpen(false);
    // Drop after close animation frame.
    setTimeout(() => setQueue((q) => q.slice(1)), 150);
  };

  const opts = current?.options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open && !!current}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        <AlertDialogContent>
          {opts ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{opts.title}</AlertDialogTitle>
                {opts.description ? (
                  <AlertDialogDescription>{opts.description}</AlertDialogDescription>
                ) : null}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => settle(false)}>
                  {opts.cancelLabel ?? "Cancel"}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => settle(true)}
                  className={cn(
                    opts.destructive &&
                      buttonVariants({ variant: "destructive" }),
                  )}
                >
                  {opts.confirmLabel ?? (opts.destructive ? "Delete" : "Confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmDialogProvider>");
  return ctx;
}
