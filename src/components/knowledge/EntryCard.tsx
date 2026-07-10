import { motion, type PanInfo } from "framer-motion";
import { useState } from "react";
import { Pin, Archive, FileText, Link as LinkIcon, Mic, Upload, Linkedin, ClipboardType } from "lucide-react";
import type { KnowledgeEntry } from "./shared";
import { SOURCE_LABELS } from "./shared";

const SOURCE_ICON: Record<string, typeof FileText> = {
  paste: ClipboardType,
  url: LinkIcon,
  upload: Upload,
  audio: Mic,
  voice_memo: Mic,
  linkedin: Linkedin,
  resume: FileText,
};

type Props = {
  entry: KnowledgeEntry;
  onTap: () => void;
  onPin: (pinned: boolean) => void;
  onArchive: () => void;
};

export function EntryCard({ entry, onTap, onPin, onArchive }: Props) {
  const [x, setX] = useState(0);
  const Icon = SOURCE_ICON[entry.source_type] ?? FileText;

  const handleEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) {
      onPin(!entry.pinned);
    } else if (info.offset.x < -100) {
      onArchive();
    }
    setX(0);
  };

  return (
    <div className="relative">
      {/* Swipe hint bg */}
      <div className="absolute inset-0 flex items-center justify-between rounded-lg px-4 text-xs">
        <span className={`flex items-center gap-1 text-accent transition-opacity ${x > 40 ? "opacity-100" : "opacity-0"}`}>
          <Pin className="h-4 w-4" /> {entry.pinned ? "Unpin" : "Pin"}
        </span>
        <span className={`flex items-center gap-1 text-destructive transition-opacity ${x < -40 ? "opacity-100" : "opacity-0"}`}>
          Archive <Archive className="h-4 w-4" />
        </span>
      </div>
      <motion.button
        type="button"
        onClick={onTap}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDrag={(_, info) => setX(info.offset.x)}
        onDragEnd={handleEnd}
        animate={{ x: 0 }}
        className="relative flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left"
      >
        <div className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-surface-elev">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate font-medium">
              {entry.title ?? "Untitled"}
            </div>
            {entry.pinned && <Pin className="h-3.5 w-3.5 flex-shrink-0 text-accent" />}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{SOURCE_LABELS[entry.source_type] ?? entry.source_type}</span>
            {entry.tags.length > 0 && (
              <span className="flex gap-1">
                {entry.tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-pill bg-surface-elev px-1.5 py-0.5">
                    #{t}
                  </span>
                ))}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {entry.content?.slice(0, 180) ?? ""}
          </p>
        </div>
      </motion.button>
    </div>
  );
}
