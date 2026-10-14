// Server-only Lovable AI Gateway provider helper.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { GatewayError, isRetryableStatus, retryDelayMs } from "./gateway-errors";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });
  const publishRunId = (value?: string) => {
    const next = value?.trim() || undefined;
    if (!runId && next) runId = next;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    fetch: (async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (err) {
        publishRunId(undefined);
        throw err;
      }
    }) as typeof fetch,
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

export function createLovableAiGatewayProvider(
  lovableApiKey: string,
  initialRunId?: string,
  options?: { structuredOutputs?: boolean },
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}

export function getGatewayKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

/**
 * OpenAI Responses provider. GPT-6 models (e.g. openai/gpt-6-astra) only
 * support tool calling on /v1/responses, so they must go through this
 * provider's `.responses(model)` instead of the openai-compatible one.
 */
export function createLovableAiGatewayResponsesProvider(
  lovableApiKey: string,
  initialRunId?: string,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: lovableApiKey,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}

/** True for models that must be called via the Responses API. */
export function requiresResponsesApi(model: string) {
  return /^openai\/gpt-6/.test(model);
}

/**
 * Resolves the right LanguageModel for a model id: GPT-6 via Responses,
 * everything else via the openai-compatible chat-completions provider.
 */
export function resolveGatewayModel(model: string, initialRunId?: string): LanguageModel {
  const key = getGatewayKey();
  if (requiresResponsesApi(model)) {
    return createLovableAiGatewayResponsesProvider(key, initialRunId).responses(model);
  }
  return createLovableAiGatewayProvider(key, initialRunId)(model);
}

/**
 * Raw gateway fetch for endpoints not covered by AI SDK (STT, image gen).
 * Retries 429/5xx up to 2 times (honouring Retry-After); other failures are
 * terminal. Throws a GatewayError with a safe, human-readable message — the
 * upstream body is only logged server-side.
 */
export async function gatewayFetch(path: string, init: RequestInit) {
  const key = getGatewayKey();
  const headers = new Headers(init.headers);
  headers.set("Lovable-API-Key", key);
  headers.set("X-Lovable-AIG-SDK", "raw");
  const MAX_RETRIES = 2;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://ai.gateway.lovable.dev/v1${path}`, { ...init, headers });
    if (res.ok) return res;
    const body = await res.text().catch(() => "");
    console.error(`[gateway] ${path} ${res.status}: ${body.slice(0, 500)}`);
    if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, retryDelayMs(attempt, res.headers.get("retry-after"))));
      continue;
    }
    throw new GatewayError(res.status);
  }
}
