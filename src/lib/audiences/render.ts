// Format an audience row (name + structured ICP) into a compact prompt block
// so any surface — orchestrator, milestone actor, create pipeline — can inject
// the same [AUDIENCE] context and produce audience-specific copy.

type IcpLike = {
  persona?: string | null;
  role_titles?: string[] | null;
  industries?: string[] | null;
  company_size?: string | null;
  seniority?: string | null;
  goals?: string[] | null;
  pains?: string[] | null;
  channels?: string[] | null;
  tone_preference?: string | null;
  objections?: string[] | null;
  success_metrics?: string[] | null;
};

export type AudienceForPrompt = {
  name?: string | null;
  description?: string | null;
  icp?: IcpLike | null;
};

const j = (arr?: string[] | null) =>
  arr && arr.length ? arr.filter(Boolean).join(", ") : null;

/** Multi-line block; caller decides whether to wrap in `[AUDIENCE]\n...`. */
export function renderAudienceBlock(a: AudienceForPrompt | null | undefined): string {
  if (!a) return "";
  const icp = (a.icp ?? {}) as IcpLike;
  const rows: string[] = [];
  if (a.name) rows.push(`Name: ${a.name}`);
  if (a.description) rows.push(`Summary: ${a.description}`);
  if (icp.persona) rows.push(`Persona: ${icp.persona}`);
  const titles = j(icp.role_titles);
  if (titles) rows.push(`Roles: ${titles}`);
  if (icp.seniority) rows.push(`Seniority: ${icp.seniority}`);
  const industries = j(icp.industries);
  if (industries) rows.push(`Industries: ${industries}`);
  if (icp.company_size) rows.push(`Company size: ${icp.company_size}`);
  const pains = j(icp.pains);
  if (pains) rows.push(`Pains: ${pains}`);
  const goals = j(icp.goals);
  if (goals) rows.push(`Goals: ${goals}`);
  const objections = j(icp.objections);
  if (objections) rows.push(`Objections: ${objections}`);
  const metrics = j(icp.success_metrics);
  if (metrics) rows.push(`Success metrics: ${metrics}`);
  const channels = j(icp.channels);
  if (channels) rows.push(`Channels: ${channels}`);
  if (icp.tone_preference) rows.push(`Tone preference: ${icp.tone_preference}`);
  return rows.join("\n");
}

/** Full `[AUDIENCE]` block ready to concat into a system prompt. */
export function audiencePromptBlock(a: AudienceForPrompt | null | undefined): string {
  const body = renderAudienceBlock(a);
  if (!body) return "";
  return `[AUDIENCE]\n${body}\n\nRule: Speak directly to this reader. Use their vocabulary, address their pains, and frame every claim against their success metrics.`;
}
