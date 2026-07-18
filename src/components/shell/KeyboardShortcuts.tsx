import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Global keyboard shortcuts for the authenticated shell.
 * - ⌘/Ctrl + K → Library search
 * - g then h → Home
 * - g then d → Drafts
 * - g then l → Library
 * - g then q → Queue
 * - g then m → Media
 * - g then s → Settings
 * - ? → Open this shortcuts sheet
 *
 * Ignored while typing in inputs/textareas/contenteditable.
 */
export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    };

    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — global search (always, even while typing)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigate({ to: "/library" });
        return;
      }

      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;

      // "?" — shortcuts sheet
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // g <letter> — go to route
      if (pendingG) {
        pendingG = false;
        if (gTimer) clearTimeout(gTimer);
        const map: Record<string, string> = {
          h: "/",
          d: "/content/drafts",
          l: "/library",
          q: "/queue",
          m: "/media",
          s: "/settings",
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          navigate({ to: target });
        }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        pendingG = true;
        gTimer = setTimeout(() => {
          pendingG = false;
        }, 900);
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Speed through the app without touching the mouse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <Group title="Global">
            <Row keys={["⌘", "K"]} label="Open library search" />
            <Row keys={["?"]} label="Show this help" />
          </Group>
          <Group title="Go to…">
            <Row keys={["g", "h"]} label="Home" />
            <Row keys={["g", "d"]} label="Drafts" />
            <Row keys={["g", "l"]} label="Library" />
            <Row keys={["g", "q"]} label="Queue" />
            <Row keys={["g", "m"]} label="Media" />
            <Row keys={["g", "s"]} label="Settings" />
          </Group>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md px-2 py-1 hover:bg-surface-elev">
      <span className="text-foreground">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="min-w-[1.5rem] rounded border border-border bg-surface px-1.5 py-0.5 text-center text-[11px] font-medium text-muted-foreground"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  );
}
