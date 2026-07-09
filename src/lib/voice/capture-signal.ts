// Client helper: fire-and-forget signal capture. Never throws to the caller,
// never blocks the UI. Wire this into any edit / approve / reject / regenerate.
import { captureVoiceSignal } from "./voice.functions";

type SignalType = "edit" | "approval" | "rejection" | "regeneration";

export function captureSignal(input: {
  signalType: SignalType;
  originalText: string;
  editedText?: string;
  voiceProfileId?: string;
  context?: Record<string, unknown>;
}) {
  try {
    void captureVoiceSignal({
      data: {
        signalType: input.signalType,
        originalText: input.originalText,
        editedText: input.editedText,
        voiceProfileId: input.voiceProfileId,
        context: input.context ?? {},
      },
    }).catch(() => {
      // swallow — telemetry must never break the UI
    });
  } catch {
    // ignore
  }
}
