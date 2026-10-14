import { describe, it, expect } from "vitest";
import { friendlyGatewayMessage, isRetryableStatus, retryDelayMs, GatewayError } from "../gateway-errors";
import { modelCallOptions } from "../../orchestrator/config";
import { dossierToSections } from "../../research/company-research.server";

describe("modelCallOptions", () => {
  it("sends max_completion_tokens + reasoning none on gpt-5.6", () => {
    expect(modelCallOptions("openai/gpt-5.6-sol", 100)).toEqual({
      providerOptions: { lovable: { max_completion_tokens: 100, reasoningEffort: "none" } },
    });
  });
  it("never sends maxOutputTokens to gpt-5 family", () => {
    expect(modelCallOptions("openai/gpt-5.5", 50)).not.toHaveProperty("maxOutputTokens");
  });
  it("uses maxOutputTokens elsewhere", () => {
    expect(modelCallOptions("google/gemini-2.5-flash", 50)).toEqual({ maxOutputTokens: 50 });
  });
});

describe("gateway errors", () => {
  it("gives friendly messages without raw bodies", () => {
    expect(friendlyGatewayMessage(402)).toMatch(/credits/i);
    expect(friendlyGatewayMessage(429)).toMatch(/busy/i);
    expect(new GatewayError(503).message).toMatch(/try again/i);
  });
  it("retries only 429 and 5xx", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(402)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
  });
  it("honours Retry-After", () => {
    expect(retryDelayMs(0, "3")).toBe(3000);
  });
});

describe("dossierToSections", () => {
  it("renders an overview even for a sparse dossier", () => {
    const s = dossierToSections({ company: { name: "Acme", description: "Makes things", website: "acme.com" } } as never);
    expect(s[0].heading).toBe("Overview");
    expect(s[0].body).toContain("Makes things");
  });
});
