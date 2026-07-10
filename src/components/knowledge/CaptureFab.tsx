import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  ClipboardType,
  Link as LinkIcon,
  Upload,
  Linkedin,
  Plus,
  X,
} from "lucide-react";

export type CaptureAction = "speak" | "paste" | "url" | "upload" | "linkedin";

type Props = {
  onPick: (action: CaptureAction) => void;
};

const ACTIONS: { id: CaptureAction; label: string; Icon: typeof Mic }[] = [
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "upload", label: "Upload", Icon: Upload },
  { id: "url", label: "URL", Icon: LinkIcon },
  { id: "paste", label: "Paste", Icon: ClipboardType },
  { id: "speak", label: "Speak", Icon: Mic },
];

export function CaptureFab({ onPick }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-40 sm:bottom-8 sm:right-8">
      {open && (
        <div className="pointer-events-auto absolute inset-0 -m-96" onClick={() => setOpen(false)} />
      )}

      <div className="pointer-events-auto relative flex flex-col items-end gap-3">
        {open &&
          ACTIONS.map(({ id, label, Icon }, i) => (
            <motion.button
              key={id}
              type="button"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => {
                setOpen(false);
                onPick(id);
              }}
              className="flex items-center gap-3 rounded-full border border-border bg-surface-elev px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur"
            >
              <span className="font-medium">{label}</span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" />
              </span>
            </motion.button>
          ))}

        <button
          type="button"
          aria-label={open ? "Close capture menu" : "Add knowledge"}
          onClick={() => setOpen((v) => !v)}
          className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-xl transition-transform active:scale-95 amber-glow"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}
