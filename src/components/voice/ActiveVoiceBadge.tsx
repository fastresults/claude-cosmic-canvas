// Compact active-voice indicator. Renders as a chip above the composer input
// so the user always knows what voice will apply. Tap to jump to voice picker.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, AlertCircle } from "lucide-react";
import { getActiveVoice } from "@/lib/voice/voice.functions";

export function ActiveVoiceBadge() {
  const fn = useServerFn(getActiveVoice);
  const { data: active } = useQuery({
    queryKey: ["voice-active"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  if (active === undefined) return null;

  if (!active) {
    return (
      <Link
        to="/settings/voice"
        className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive"
      >
        <AlertCircle className="h-3 w-3" />
        Pick a voice
      </Link>
    );
  }

  return (
    <Link
      to="/settings/voice"
      className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
    >
      <Sparkles className="h-3 w-3" />
      {active.name}
    </Link>
  );
}
