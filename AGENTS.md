<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## AI calls
- Model IDs live only in `src/lib/ai/models.ts`; why: one place to upgrade models.
- Token caps and reasoning options go through `modelCallOptions()` in `src/lib/orchestrator/config.ts`; why: GPT-5.x rejects `max_tokens`, GPT-6 requires reasoning and no temperature.
- Resolve models with `resolveGatewayModel()` in `src/lib/ai/gateway.server.ts`, never `provider(model)` directly; why: GPT-6 tool calls only work on the Responses API.
- Long or tool-loop calls use `runStreamed()` (`src/lib/ai/stream.server.ts`), not `generateText`; why: buffered runs time out and get billed again.
- Structured AI output uses `generateStructuredJson()` with a zod schema, never regex JSON parsing; why: chatty replies crashed steps.
- Gateway failures surface through `GatewayError`/`friendlyGatewayMessage` (mapped in `server-fn-sanitize.ts`); why: users never see raw upstream errors.
- Server functions that call a model use the `aiRateLimit` middleware instead of `requireSupabaseAuth`; why: shared per-user AI budget.
- Routes without their own `errorComponent` fall back to `RouteError` via `defaultErrorComponent` in `src/router.tsx`.
- Structured calls build the provider with `structuredOutputs: true` for every model; why: without it Gemini ignores the schema and returns unparseable text.
- Unit tests live in `src/**/__tests__/*.test.ts` and run with `bunx vitest run`.

- The Orb (`src/components/primitives/Orb.tsx`) wraps `VoicePoweredOrb.tsx` (ogl WebGL shader); ogl is dynamically imported inside a mount effect, never at module scope; why: SSR must not touch WebGL. The orb never opens its own microphone — feed `level` from `useAudioLevel`; why: the app already owns the mic stream.
