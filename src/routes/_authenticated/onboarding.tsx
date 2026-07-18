// Warm, guided setup journey. Presents the four pillars as a friendly
// narrative: Welcome → Voice → Expertise → Confirm → Celebrate. Reuses the
// existing `finishOnboarding` server function which seeds all four pillars
// (voice, knowledge, domain, audience). Autosaves draft to localStorage.
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, Mic, Compass, ArrowRight, Check, PartyPopper } from "lucide-react";
import { finishOnboarding } from "@/lib/onboarding/onboarding.functions";
import { Orb } from "@/components/primitives/Orb";
import { Pill } from "@/components/primitives/Pill";
import { Textarea } from "@/components/ui/textarea";
import { CompletionCelebration } from "@/components/onboarding/CompletionCelebration";
import { hapticTap, hapticEnd } from "@/lib/platform/haptics";

type SearchParams = { resume?: string };

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    resume: typeof search.resume === "string" ? search.resume : undefined,
  }),
  component: OnboardingPage,
});

const DOMAIN_SUGGESTIONS = [
  "Product",
  "Founder life",
  "AI",
  "Design",
  "Marketing",
  "Engineering",
  "Sales",
  "Community",
];

const DRAFT_KEY = "eve.onboarding.draft.v2";

type Draft = {
  personaName: string;
  domains: string[];
  toneSamples: string[];
  goals: string;
};

const EMPTY: Draft = {
  personaName: "",
  domains: [],
  toneSamples: ["", "", ""],
  goals: "",
};

function loadDraft(): Draft {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      personaName: typeof parsed.personaName === "string" ? parsed.personaName : "",
      domains: Array.isArray(parsed.domains) ? parsed.domains : [],
      toneSamples:
        Array.isArray(parsed.toneSamples) && parsed.toneSamples.length === 3
          ? parsed.toneSamples.map((s: unknown) => (typeof s === "string" ? s : ""))
          : ["", "", ""],
      goals: typeof parsed.goals === "string" ? parsed.goals : "",
    };
  } catch {
    return EMPTY;
  }
}

function OnboardingPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const finish = useServerFn(finishOnboarding);

  // 0 = welcome, 1 = voice, 2 = expertise, 3 = confirm, 4 = celebrate
  const [step, setStep] = useState(search.resume ? 1 : 0);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Hydrate draft from localStorage on mount only (SSR-safe).
  useEffect(() => {
    setDraft(loadDraft());
    setHydrated(true);
  }, []);

  // Autosave.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* quota — ignore */
    }
  }, [draft, hydrated]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDomain(d: string) {
    hapticTap();
    setDraft((prev) => ({
      ...prev,
      domains: prev.domains.includes(d)
        ? prev.domains.filter((x) => x !== d)
        : [...prev.domains, d],
    }));
  }

  const canAdvance =
    (step === 1 && draft.personaName.trim().length >= 2 && draft.toneSamples.filter((s) => s.trim().length > 8).length >= 1) ||
    (step === 2 && draft.domains.length >= 1);

  function goNext() {
    hapticTap();
    setStep((s) => Math.min(s + 1, 4));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await finish({
        data: {
          personaName: draft.personaName.trim(),
          domains: draft.domains,
          toneSamples: draft.toneSamples.map((s) => s.trim()).filter((s) => s.length > 3),
          goals: draft.goals.trim() || undefined,
        },
      });
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch { /* ignore */ }
      hapticEnd();
      setStep(4);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      toast.error("Couldn't save that", { description: "Please try again in a moment." });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-6 py-8">
      {step > 0 && step < 4 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-accent">Step {step} of 3</span>
            <span>~{step === 1 ? 60 : step === 2 ? 30 : 20}s</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28 }}
          className="flex-1"
          aria-live="polite"
        >
          {step === 0 && <Welcome onStart={goNext} />}
          {step === 1 && (
            <VoiceStep
              draft={draft}
              onName={(v) => update("personaName", v)}
              onSample={(i, v) =>
                update(
                  "toneSamples",
                  draft.toneSamples.map((s, idx) => (idx === i ? v : s)),
                )
              }
            />
          )}
          {step === 2 && (
            <ExpertiseStep
              draft={draft}
              onToggleDomain={toggleDomain}
              onGoals={(v) => update("goals", v)}
            />
          )}
          {step === 3 && <ConfirmStep draft={draft} err={err} />}
          {step === 4 && <CelebrateStep onGo={() => navigate({ to: "/create", replace: true })} />}
        </motion.div>
      </AnimatePresence>

      {step > 0 && step < 4 && (
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={goBack}
            className="flex-1 rounded-md border border-border bg-surface-elev py-3 text-sm font-medium text-foreground"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={goNext}
              className="flex-[2] inline-flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="flex-[2] inline-flex items-center justify-center gap-2 rounded-md bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
            >
              {busy ? "Setting up Eve…" : "Finish setup ✨"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <Orb size={140} />
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent">
          <Sparkles className="h-3 w-3" />
          Takes about 2 minutes
        </div>
        <h1 className="font-display text-3xl text-foreground">
          Hey — let's teach Eve about you
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Three quick steps. No wrong answers. Everything you share stays yours
          and shapes how Eve writes in your voice.
        </p>
      </div>

      <ol className="w-full space-y-2 text-left">
        {[
          { icon: Mic, label: "Your voice", desc: "So Eve sounds like you." },
          { icon: Compass, label: "Your expertise", desc: "So Eve stays in your lane." },
          { icon: Check, label: "Confirm", desc: "You're in. Start creating." },
        ].map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-elev px-3 py-2.5"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-accent">
              <item.icon className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-medium text-foreground">{item.label}</div>
              <div className="text-[11px] text-muted-foreground">{item.desc}</div>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onStart}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-110"
      >
        Let's go
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function VoiceStep({
  draft,
  onName,
  onSample,
}: {
  draft: Draft;
  onName: (v: string) => void;
  onSample: (i: number, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-foreground">Your voice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give your voice a name, then paste 1–3 short things you've written.
          Eve learns your cadence from these.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          What should Eve call this voice?
        </label>
        <input
          autoFocus
          value={draft.personaName}
          onChange={(e) => onName(e.target.value)}
          placeholder="e.g. Alex — founder voice"
          className="w-full rounded-md border border-input bg-surface-elev px-4 py-3 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Paste 1–3 things you've written
        </label>
        <p className="text-[11px] text-muted-foreground">
          Tweets, LinkedIn posts, emails — anything that sounds like you.
        </p>
        {draft.toneSamples.map((s, i) => (
          <Textarea
            key={i}
            value={s}
            onChange={(e) => onSample(i, e.target.value)}
            placeholder={
              i === 0
                ? "The most recent post that felt like you nailed it…"
                : `Sample ${i + 1} (optional)`
            }
            rows={3}
            className="resize-none border-input bg-surface-elev focus-visible:border-accent"
          />
        ))}
      </div>
    </div>
  );
}

function ExpertiseStep({
  draft,
  onToggleDomain,
  onGoals,
}: {
  draft: Draft;
  onToggleDomain: (d: string) => void;
  onGoals: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-foreground">Your expertise</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the topics you write about. Eve stays in your lane and drafts
          your audience from these.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          What do you write about?
        </label>
        <div className="flex flex-wrap gap-2">
          {DOMAIN_SUGGESTIONS.map((d) => (
            <Pill
              key={d}
              type="button"
              size="sm"
              variant={draft.domains.includes(d) ? "solid" : "ghost"}
              onClick={() => onToggleDomain(d)}
            >
              {d}
            </Pill>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Pick at least one. You can add more later.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          What do you want Eve to help you do?{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          value={draft.goals}
          onChange={(e) => onGoals(e.target.value)}
          placeholder="e.g. build in public, book demos, grow to 10k followers"
          className="w-full rounded-md border border-input bg-surface-elev px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}

function ConfirmStep({ draft, err }: { draft: Draft; err: string | null }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-foreground">Ready?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what we'll set up. You can change any of this later in
          Settings.
        </p>
      </div>

      <dl className="space-y-2 rounded-xl border border-border bg-surface-elev p-4 text-sm">
        <Row label="Voice">{draft.personaName || "—"}</Row>
        <Row label="Topics">{draft.domains.join(" · ") || "—"}</Row>
        <Row label="Samples">
          {draft.toneSamples.filter((s) => s.trim().length > 8).length} saved
        </Row>
        {draft.goals && <Row label="Goal">{draft.goals}</Row>}
      </dl>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-accent">What happens next</div>
        Eve builds your voice fingerprint, seeds your Brain, and drafts an
        audience for you based on your topics. Should take a few seconds.
      </div>

      {err && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      )}
    </div>
  );
}

function CelebrateStep({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <CompletionCelebration />
      <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15 text-accent">
        <PartyPopper className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-3xl text-foreground">You're in ✨</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Eve knows your voice, your topics, and who you're writing for. Let's
          make something.
        </p>
      </div>
      <button
        type="button"
        onClick={onGo}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-110"
      >
        Start creating
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}
