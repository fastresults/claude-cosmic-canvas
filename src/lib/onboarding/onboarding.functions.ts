// Onboarding pipeline. Persists persona, voice_profile, domains,
// seeds brain edges, and marks profiles.onboarded_at.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OnboardInput = z.object({
  personaName: z.string().min(1).max(80),
  domains: z.array(z.string().min(1).max(60)).min(1).max(8),
  toneSamples: z.array(z.string().min(4)).min(1).max(6),
  goals: z.string().max(500).optional(),
});

export const finishOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OnboardInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const { writeEdgesServer } = await import("@/lib/ai/provenance.server");

    // 1. Persona
    const { data: persona, error: personaErr } = await supabase
      .from("personas")
      .insert({ user_id: userId, name: data.personaName })
      .select("id")
      .single();
    if (personaErr || !persona) throw new Error(personaErr?.message ?? "persona failed");

    // 2. Ask Claude to distill a voice profile from samples.
    const distill = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      system:
        "You extract a writing-voice fingerprint from short samples. " +
        "Respond ONLY with compact JSON of the shape " +
        '{"signals":{"tone":string,"cadence":string,"vocabulary":string,"signature_moves":string[]},' +
        '"directives":{"do":string[],"dont":string[]}}. ' +
        "Do not include any prose outside the JSON.",
      prompt:
        `Samples from ${data.personaName}:\n\n` +
        data.toneSamples.map((s, i) => `${i + 1}. ${s}`).join("\n\n") +
        (data.goals ? `\n\nStated goals: ${data.goals}` : ""),
    });

    let signals: unknown = {};
    let directives: unknown = { do: [], dont: [] };
    try {
      const parsed = JSON.parse(distill.text.trim().replace(/^```(?:json)?|```$/g, ""));
      signals = parsed.signals ?? signals;
      directives = parsed.directives ?? directives;
    } catch {
      // fallback stays as empty; UI can surface a "refine" nudge later
    }

    // 3. Voice profile
    const { data: voice, error: voiceErr } = await supabase
      .from("voice_profiles")
      .insert({
        user_id: userId,
        persona_id: persona.id,
        samples: data.toneSamples,
        signals: signals as never,
        directives: directives as never,
        match_threshold: 0.75,
        validated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (voiceErr) throw voiceErr;

    // 4. Domains — first one becomes the default so the Domain pillar is satisfied.
    const domainRows = data.domains.map((name, i) => ({
      user_id: userId,
      name,
      is_default: i === 0,
    }));
    const { data: domains, error: domainErr } = await supabase
      .from("domains")
      .insert(domainRows)
      .select("id, name");
    if (domainErr) throw domainErr;

    // 4b. Default knowledge profile (Knowledge pillar).
    const { data: existingKp } = await supabase
      .from("knowledge_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    if (!existingKp) {
      await supabase
        .from("knowledge_profiles")
        .insert({ user_id: userId, name: "Personal", kind: "personal", is_default: true });
    }

    // 4c. Default audience (Audience pillar) — seed a placeholder ICP the user can refine later.
    const { data: existingAud } = await supabase
      .from("audiences")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    if (!existingAud) {
      const primaryDomain = data.domains[0] ?? "your field";
      await supabase.from("audiences").insert({
        user_id: userId,
        name: `${primaryDomain} audience`,
        description: `People who care about ${data.domains.join(", ")}.`,
        icp: {
          persona: `Someone interested in ${primaryDomain}.`,
          role_titles: [],
          industries: [],
          goals: data.goals ? [data.goals] : [],
          pains: [],
          channels: [],
          tone_preference: "",
          objections: [],
          success_metrics: [],
        } as never,
        is_default: true,
        is_ai_generated: false,
      });
    }

    // 5. Mark profile onboarded, active persona, and active voice (Voice pillar).
    await supabase
      .from("profiles")
      .update({
        persona_active_id: persona.id,
        active_voice_id: voice?.id ?? null,
        onboarded_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // 6. Seed brain edges: You -> Persona -> Voice / Domains
    const edges = [
      {
        srcType: "you" as const,
        srcId: userId,
        edgeKind: "AUTHORED_BY" as const,
        dstType: "persona" as const,
        dstId: persona.id,
        meta: { name: data.personaName },
      },
      ...(voice
        ? [
            {
              srcType: "persona" as const,
              srcId: persona.id,
              edgeKind: "SPEAKS_IN" as const,
              dstType: "voice_sample" as const,
              dstId: voice.id,
              meta: {},
            },
          ]
        : []),
      ...(domains ?? []).map((d) => ({
        srcType: "persona" as const,
        srcId: persona.id,
        edgeKind: "EXPERT_IN" as const,
        dstType: "domain" as const,
        dstId: d.id,
        meta: { name: d.name },
      })),
    ];
    await writeEdgesServer(supabase, userId, edges);

    return { personaId: persona.id, voiceId: voice?.id ?? null };
  });
