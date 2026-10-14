// Single registry of which model does which job. Change models here only.
export const MODELS = {
  /** Orchestrator + general writing (tool loops, drafts, content). */
  orchestrator: "openai/gpt-6-astra",
  /** Structured analysis (voice, presets). */
  analysis: "openai/gpt-5.5",
  /** Fast/cheap helpers (voice samples, image concepts). */
  fast: "google/gemini-2.5-flash",
  /** Audience + domain research. */
  research: "google/gemini-3-flash-preview",
  /** Long-form company dossier synthesis. */
  dossier: "google/gemini-2.5-pro",
  /** Draft image generation. */
  image: "google/gemini-3-pro-image",
  imageQuick: "google/gemini-2.5-flash-image",
  embedding: "openai/text-embedding-3-small",
  transcribe: "openai/gpt-4o-transcribe",
} as const;
