import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { finishOnboarding } from "@/lib/onboarding/onboarding.functions";
import { Orb } from "@/components/primitives/Orb";
import { Pill } from "@/components/primitives/Pill";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/onboarding")({
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

function OnboardingPage() {
  const navigate = useNavigate();
  const finish = useServerFn(finishOnboarding);

  const [step, setStep] = useState(0);
  const [personaName, setPersonaName] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [toneSamples, setToneSamples] = useState<string[]>(["", "", ""]);
  const [goals, setGoals] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleDomain(d: string) {
    setDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  const canNext =
    (step === 0 && personaName.trim().length >= 2) ||
    (step === 1 && domains.length >= 1) ||
    (step === 2 && toneSamples.filter((s) => s.trim().length > 8).length >= 1);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await finish({
        data: {
          personaName: personaName.trim(),
          domains,
          toneSamples: toneSamples.map((s) => s.trim()).filter((s) => s.length > 3),
          goals: goals.trim() || undefined,
        },
      });
      navigate({ to: "/", replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Orb size={120} />
        <div className="text-center">
          <h1 className="font-display text-2xl text-foreground">Teach Eve your voice</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Three quick steps. Everything you say seeds your Second Brain.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1 w-8 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1"
      >
        {step === 0 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">
              What should Eve call your voice?
            </label>
            <input
              autoFocus
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              placeholder="e.g. Alex, founder voice"
              className="w-full rounded-md border border-input bg-surface-elev px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <p className="text-xs text-muted-foreground">
              You can add more personas later (work, personal, brand).
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">
              What do you write about?
            </label>
            <div className="flex flex-wrap gap-2">
              {DOMAIN_SUGGESTIONS.map((d) => (
                <Pill
                  key={d}
                  type="button"
                  size="sm"
                  variant={domains.includes(d) ? "solid" : "ghost"}
                  onClick={() => toggleDomain(d)}
                >
                  {d}
                </Pill>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Pick at least one. These become nodes in your Brain.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Paste 1–3 short things you've written before
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Tweets, LinkedIn posts, emails. Eve extracts your cadence.
              </p>
            </div>
            {toneSamples.map((s, i) => (
              <Textarea
                key={i}
                value={s}
                onChange={(e) =>
                  setToneSamples((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                placeholder={`Sample ${i + 1}`}
                rows={3}
                className="resize-none border-input bg-surface-elev focus-visible:border-accent"
              />
            ))}
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Optional: what do you want Eve to help you do?
              </label>
              <input
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. build in public, book demos, grow to 10k followers"
                className="mt-1 w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {err && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
          </p>
        )}
      </motion.div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 rounded-md border border-border bg-surface-elev py-3 text-sm font-medium text-foreground"
          >
            Back
          </button>
        )}
        {step < 2 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={!canNext || busy}
            onClick={submit}
            className="flex-1 rounded-md bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {busy ? "Building your Brain…" : "Bloom the Brain"}
          </button>
        )}
      </div>
    </div>
  );
}
