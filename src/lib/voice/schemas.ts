// Client-safe Zod schemas for the Voice system.
import { z } from "zod";

export const VOICE_SIGNAL_TYPES = ["edit", "approval", "rejection", "regeneration"] as const;
export const VOICE_DIRECTIVE_TYPES = [
  "avoid_word",
  "prefer_word",
  "avoid_pattern",
  "prefer_pattern",
  "tone_shift",
  "structural",
] as const;
export const VOICE_DIRECTIVE_STATUS = ["suggested", "active", "dismissed"] as const;

export const SAMPLE_MAX_CHARS = 2000;
export const SAMPLES_MAX = 5;
export const VOCAB_MAX = 40;

export const SampleSchema = z.object({
  text: z.string(),
  source: z.string().optional(),
});
export type VoiceSample = z.infer<typeof SampleSchema>;

const clampSlider = (n: unknown) => {
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
};

export const VoiceProfileWriteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).optional().nullable(),
  tone: z.string().trim().max(400).optional().nullable(),
  guidelines: z.string().max(6000).optional().nullable(),
  vocabulary_preferred: z.array(z.string().trim().min(1).max(60)).max(VOCAB_MAX).default([]),
  vocabulary_avoid: z.array(z.string().trim().min(1).max(60)).max(VOCAB_MAX).default([]),
  formality: z.preprocess(clampSlider, z.number().int().min(0).max(100)).default(50),
  humor: z.preprocess(clampSlider, z.number().int().min(0).max(100)).default(50),
  technicality: z.preprocess(clampSlider, z.number().int().min(0).max(100)).default(50),
  conciseness: z.preprocess(clampSlider, z.number().int().min(0).max(100)).default(50),
  samples: z.array(SampleSchema).max(SAMPLES_MAX).default([]),
  persona_id: z.string().uuid().nullable().optional(),
  is_default: z.boolean().optional(),
  source: z.string().max(20).optional(),
});
export type VoiceProfileWrite = z.infer<typeof VoiceProfileWriteSchema>;

/** Case-insensitive dedupe + mutual exclusion (last-write-wins). */
export function normalizeVocab(preferred: string[], avoid: string[]) {
  const seen = new Set<string>();
  const cleanPref: string[] = [];
  for (const w of preferred) {
    const k = w.trim();
    if (!k) continue;
    const lk = k.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    cleanPref.push(k);
  }
  const prefLower = new Set(cleanPref.map((w) => w.toLowerCase()));
  const seenA = new Set<string>();
  const cleanAvoid: string[] = [];
  for (const w of avoid) {
    const k = w.trim();
    if (!k) continue;
    const lk = k.toLowerCase();
    if (seenA.has(lk) || prefLower.has(lk)) continue;
    seenA.add(lk);
    cleanAvoid.push(k);
  }
  return { preferred: cleanPref.slice(0, VOCAB_MAX), avoid: cleanAvoid.slice(0, VOCAB_MAX) };
}

/** Strip markdown artifacts from a sample and clamp length. */
export function cleanSample(text: string): string {
  const stripped = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .trim();
  return stripped.slice(0, SAMPLE_MAX_CHARS);
}
