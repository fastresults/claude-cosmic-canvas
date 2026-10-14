// Orchestrator provider — thin wrapper over the single gateway module in
// src/lib/ai/gateway.server.ts so header/run-id logic lives in one place.
import {
  createLovableAiGatewayProvider,
  createLovableAiGatewayRunIdFetch,
  getGatewayKey,
} from "@/lib/ai/gateway.server";

export const createOrchestratorRunIdFetch = createLovableAiGatewayRunIdFetch;

export function createOrchestratorProvider(initialRunId?: string) {
  return createLovableAiGatewayProvider(getGatewayKey(), initialRunId);
}
