// Server-only pipeline for McKinsey-grade Company Research.
// Ported from the Thought Leader Studio `research-company-profile` edge fn.
//
// Pipeline:
//   1. Firecrawl /v2/map to discover URLs on the site.
//   2. Rank + select top pages, then Firecrawl /v2/scrape each in parallel.
//   3. In parallel: Perplexity `sonar-pro` for external intelligence.
//   4. Single AI synthesis (google/gemini-2.5-pro, JSON mode).
//
// Firecrawl is gateway-backed in this project (uses_connector_gateway: true),
// so we call https://connector-gateway.lovable.dev/firecrawl/v2/* with
// Authorization: Bearer $LOVABLE_API_KEY + X-Connection-Api-Key.
// Perplexity is direct-API: call api.perplexity.ai with PERPLEXITY_API_KEY.

const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

const HIGH_VALUE_PATTERNS: RegExp[] = [
  /\/(about|company|who-we-are)/i,
  /\/(team|leadership|people|founders|management|executives|staff|board)/i,
  /\/(investors?|funding|backed-by|partners)/i,
  /\/(pricing|plans|products?|services?|solutions?|features?|offerings?)/i,
  /\/(press|news|media|newsroom|blog|announcements?)/i,
  /\/(careers?|jobs?|hiring)/i,
  /\/(contact|faq|help)/i,
  /\/(technology|platform|how-it-works|integrations?)/i,
  /\/(customers?|case-stud|testimonials?|success-stories?)/i,
  /\/(mission|vision|values|culture|story|history)/i,
];

function firecrawlHeaders(): Record<string, string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const fireKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!fireKey) throw new Error("FIRECRAWL_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": fireKey,
    "Content-Type": "application/json",
  };
}

async function scrapePage(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${FIRECRAWL_GATEWAY}/scrape`, {
      method: "POST",
      headers: firecrawlHeaders(),
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 1200,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[research] scrape failed ${res.status} for ${url}`);
      return "";
    }
    const data = (await res.json()) as {
      data?: { markdown?: string };
      markdown?: string;
    };
    return data.data?.markdown ?? data.markdown ?? "";
  } catch (e) {
    console.warn(`[research] scrape error for ${url}:`, e);
    return "";
  }
}


async function discoverAndScrapePages(
  baseUrl: string,
  maxPages: number,
): Promise<{ pages: string[]; selectedUrls: string[] }> {
  let discoveredUrls: string[] = [];
  try {
    const mapRes = await fetch(`${FIRECRAWL_GATEWAY}/map`, {
      method: "POST",
      headers: firecrawlHeaders(),
      body: JSON.stringify({ url: baseUrl, limit: 100, includeSubdomains: false }),
    });
    if (mapRes.ok) {
      const mapData = (await mapRes.json()) as {
        links?: unknown;
        data?: { links?: unknown };
      };
      const rawLinks =
        (Array.isArray(mapData.links) ? mapData.links : mapData.data?.links) ?? [];
      discoveredUrls = (rawLinks as Array<string | { url?: string }>)
        .map((entry) => (typeof entry === "string" ? entry : entry?.url ?? ""))
        .filter((u): u is string => typeof u === "string" && u.length > 0);
    } else {
      console.warn(`[research] map failed ${mapRes.status}`);
    }
  } catch (e) {
    console.warn("[research] map error:", e);
  }

  const scored = discoveredUrls
    .filter((u) => {
      try {
        const parsed = new URL(u);
        if (parsed.hash) return false;
        if (/\.(pdf|png|jpg|jpeg|gif|svg|css|js|xml|json)$/i.test(parsed.pathname)) return false;
        if (/\/(login|signup|sign-in|sign-up|register|auth|account|cart|checkout)/i.test(parsed.pathname)) return false;
        return true;
      } catch {
        return false;
      }
    })
    .map((u) => {
      let score = 0;
      for (const pattern of HIGH_VALUE_PATTERNS) {
        if (pattern.test(u)) {
          score += 10;
          break;
        }
      }
      try {
        const parsed = new URL(u);
        if (parsed.pathname === "/" || parsed.pathname === "") score += 5;
      } catch {
        // ignore
      }
      return { url: u, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = new Set<string>();
  selected.add(baseUrl);
  for (const item of scored) {
    if (selected.size >= maxPages) break;
    selected.add(item.url);
  }

  const urls = [...selected];
  const results = await Promise.all(urls.map((u) => scrapePage(u)));
  return {
    pages: results.filter((r) => r.length > 100),
    selectedUrls: urls,
  };
}

async function searchExternalIntelligence(
  companyName: string,
  companyUrl: string,
): Promise<string> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) {
    console.warn("[research] no PERPLEXITY_API_KEY, skipping external enrichment");
    return "";
  }
  const searchPrompt = `Provide a comprehensive factual briefing on "${companyName}" (${companyUrl}). Include ALL of the following if available:

1. FINANCIAL INFORMATION: Total funding raised, funding rounds (dates, amounts, lead investors), valuation, revenue figures, financial performance, donors, sponsors, revenue sources, how the organization makes money
2. BOARD OF DIRECTORS & ADVISORS: Full names, titles, affiliations, backgrounds
3. LEADERSHIP & KEY EXECUTIVES: Names, roles, backgrounds beyond what's on their website
4. INVESTORS & BACKERS: All known investors, venture capital firms, angel investors, institutional backers, donors, sponsors
5. RECENT NEWS & PRESS: Major announcements, partnerships, acquisitions, controversies from the last 12 months
6. COMPETITIVE LANDSCAPE: Key competitors and how they compare
7. MARKET POSITION: Market share, industry rankings, analyst coverage
8. PARTNERSHIPS & ALLIANCES: Strategic partnerships, integrations, channel partners
9. AWARDS & RECOGNITION: Industry awards, certifications, notable rankings
10. KEY CUSTOMERS: Named customers, case studies, notable logos

Be exhaustive and factual. Include specific numbers, dates, and names wherever possible. If this is a nonprofit, club, or association, include membership numbers, dues structure, major donors, grant funding, and governance structure.`;

  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a corporate intelligence researcher. Provide factual, well-sourced information. Include specific numbers, dates, and names. Be exhaustive.",
          },
          { role: "user", content: searchPrompt },
        ],
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[research] perplexity failed ${res.status}: ${body.slice(0, 200)}`);
      return "";
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    console.warn("[research] perplexity error:", e);
    return "";
  }
}

export type CompanyDossier = {
  company: {
    name: string;
    description: string | null;
    website: string;
    founded: string | null;
    headquarters: string | null;
    employeeCount: string | null;
    logoUrl: string | null;
    industry: string | null;
    tagline: string | null;
  };
  founders: Array<{ name: string; role: string; background: string; linkedin: string | null }>;
  boardAndAdvisors: Array<{ name: string; role: string; affiliation: string | null; background: string | null }>;
  funding: {
    totalRaised: string | null;
    latestRound: string | null;
    latestValuation: string | null;
    investors: string[];
  };
  fundingRounds: Array<{ date: string | null; type: string; amount: string; leadInvestor: string | null }>;
  competitors: Array<{ name: string; description: string; differentiation: string }>;
  recentNews: Array<{ title: string; date: string | null; source: string | null; summary: string }>;
  techStack: string[];
  market: {
    targetMarket: string | null;
    marketSize: string | null;
    businessModel: string | null;
  };
  redFlags: string[];
  keyProducts: Array<{ name: string; description: string }>;
  partnerships: string[];
  awards: string[];
  customers: string[];
  strategicInsights: {
    growthTrajectory: string | null;
    competitiveAdvantage: string | null;
    risks: string | null;
    opportunities: string | null;
  };
};

async function synthesizeDossier(args: {
  companyName: string;
  companyUrl: string;
  additionalContext: string;
  scrapedPages: string[];
  externalIntel: string;
}): Promise<CompanyDossier> {
  const { companyName, companyUrl, additionalContext, scrapedPages, externalIntel } = args;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

  const maxChars = 45000;
  let combined = scrapedPages.join("\n\n---\n\n");
  if (combined.length > maxChars) combined = combined.slice(0, maxChars) + "\n\n[Content truncated...]";
  const maxExt = 15000;
  let ext = externalIntel;
  if (ext.length > maxExt) ext = ext.slice(0, maxExt) + "\n\n[External intel truncated...]";

  const contextClause = additionalContext
    ? `\nAdditional context provided by the user: ${additionalContext}`
    : "";

  const systemPrompt = `You are a McKinsey-caliber corporate intelligence analyst producing exhaustive company dossiers for senior executives and investors. Your reports are the gold standard of corporate due diligence.

CORE PRINCIPLES:
- Be EXHAUSTIVE. Extract every single data point from ALL provided sources. Leave nothing on the table.
- CROSS-REFERENCE website content with external intelligence to build the most complete picture possible.
- Write in analytical prose, not bullet points. Each section should read like a management consulting deliverable.
- Provide CONTEXT and ANALYSIS, not just facts. Explain what the data means, why it matters, and what implications it has.
- For every section, write AT MINIMUM 3-5 substantial sentences. For key sections (description, market, competitors), write full paragraphs.
- The EXTERNAL INTELLIGENCE section contains verified third-party data about funding, investors, board members, news, and financials. Prioritize this for financial data.
- If information is not found in ANY source, set to null. NEVER fabricate data.
- Identify patterns: growth trajectory, strategic pivots, market positioning shifts.
- For nonprofits, clubs, or associations: detail membership structure, dues/fees, donor base, grant funding, governance, and revenue sources.`;

  const userPrompt = `Produce an exhaustive, McKinsey-grade corporate intelligence dossier for "${companyName}".${contextClause}

Website: ${companyUrl}

You have TWO data sources. Synthesize BOTH to produce the most complete dossier possible:

SOURCE 1 — SCRAPED WEBSITE CONTENT (${scrapedPages.length} pages):
${combined}
--- END SOURCE 1 ---

${ext ? `SOURCE 2 — EXTERNAL INTELLIGENCE (web research from third-party sources):
${ext}
--- END SOURCE 2 ---` : "SOURCE 2 — No external intelligence available."}

Return a JSON object with these sections. Every text field should be DETAILED and ANALYTICAL — think consulting memo, not tweet:

{
  "company": {
    "name": "string — official company name",
    "description": "string — MINIMUM 5 sentences. Cover: what they do, founding story/origin, who they serve, core value proposition, strategic positioning, and any notable achievements. Write as if briefing a CEO.",
    "website": "string",
    "founded": "string — year or 'Unknown'",
    "headquarters": "string — city, state/country",
    "employeeCount": "string — number, range, or growth trajectory if mentioned",
    "logoUrl": "string or null",
    "industry": "string — primary industry/sector and sub-sector",
    "tagline": "string or null — company tagline or slogan if found"
  },
  "founders": [
    { "name": "string", "role": "string", "background": "string — MINIMUM 3 sentences", "linkedin": "string or null" }
  ],
  "boardAndAdvisors": [
    { "name": "string", "role": "string", "affiliation": "string", "background": "string" }
  ],
  "funding": {
    "totalRaised": "string or null",
    "latestRound": "string or null",
    "latestValuation": "string or null",
    "investors": ["string"]
  },
  "fundingRounds": [
    { "date": "string", "type": "string", "amount": "string", "leadInvestor": "string or null" }
  ],
  "competitors": [
    { "name": "string", "description": "string — 2-3 sentences", "differentiation": "string — 2-3 sentences" }
  ],
  "recentNews": [
    { "title": "string", "date": "string or null", "source": "string or null", "summary": "string — 3-4 sentences" }
  ],
  "techStack": ["string"],
  "market": {
    "targetMarket": "string — MINIMUM 3 sentences",
    "marketSize": "string or null",
    "businessModel": "string — MINIMUM 3 sentences"
  },
  "redFlags": ["string"],
  "keyProducts": [
    { "name": "string", "description": "string — 2-3 sentences" }
  ],
  "partnerships": ["string"],
  "awards": ["string"],
  "customers": ["string"],
  "strategicInsights": {
    "growthTrajectory": "string — 2-3 sentences",
    "competitiveAdvantage": "string — 2-3 sentences",
    "risks": "string — 2-3 sentences",
    "opportunities": "string — 2-3 sentences"
  }
}

Be EXHAUSTIVE. This is a high-stakes executive briefing. Return ONLY the JSON.`;

  const aiRes = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.15,
      response_format: { type: "json_object" },
    }),
  });

  if (!aiRes.ok) {
    const body = await aiRes.text();
    console.error(`[research] AI Gateway ${aiRes.status}: ${body.slice(0, 300)}`);
    throw new Error(`AI synthesis failed (${aiRes.status})`);
  }

  const aiData = (await aiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = aiData.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("AI synthesis returned no content");

  let parsed: CompanyDossier;
  try {
    parsed = JSON.parse(content) as CompanyDossier;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response was not JSON");
    parsed = JSON.parse(match[0]) as CompanyDossier;
  }

  // Ensure basics
  if (parsed.company) {
    if (!parsed.company.name) parsed.company.name = companyName;
    if (!parsed.company.website) parsed.company.website = companyUrl;
  }

  return parsed;
}

export type RunCompanyResearchInput = {
  companyName: string;
  companyUrl: string;
  additionalContext?: string;
  maxPages?: number;
};

export type RunCompanyResearchResult = {
  dossier: CompanyDossier;
  pagesScraped: number;
  urlsSelected: string[];
  processingTimeMs: number;
  externalIntelUsed: boolean;
};

export async function runCompanyResearchCore(
  input: RunCompanyResearchInput,
): Promise<RunCompanyResearchResult> {
  const start = Date.now();
  const companyName = input.companyName.trim();
  const rawUrl = input.companyUrl.trim();
  const companyUrl =
    rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
  const maxPages = input.maxPages ?? 10;

  const [scrape, externalIntel] = await Promise.all([
    discoverAndScrapePages(companyUrl, maxPages),
    searchExternalIntelligence(companyName, companyUrl),
  ]);

  let pages = scrape.pages;
  if (pages.length === 0) {
    const homepage = await scrapePage(companyUrl);
    if (homepage) pages = [homepage];
  }

  const totalChars = pages.reduce((s, p) => s + p.length, 0);
  if (totalChars < 50 && externalIntel.length < 50) {
    throw new Error(
      `Could not extract meaningful content from ${companyUrl}. The site may be blocking automated access or uses heavy JavaScript rendering.`,
    );
  }

  const dossier = await synthesizeDossier({
    companyName,
    companyUrl,
    additionalContext: input.additionalContext ?? "",
    scrapedPages: pages,
    externalIntel,
  });

  return {
    dossier,
    pagesScraped: pages.length,
    urlsSelected: scrape.selectedUrls,
    processingTimeMs: Date.now() - start,
    externalIntelUsed: externalIntel.length > 0,
  };
}

/**
 * Convert a dossier into human-readable Markdown sections for `create_drafts.sections`.
 * Renders as fully-formatted content — never raw JSON — per the global rule.
 */
export function dossierToSections(
  dossier: CompanyDossier,
): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = [];
  const c = dossier.company ?? { name: "", description: null, website: "" };
  const overviewLines: string[] = [];
  if (c.tagline) overviewLines.push(`_${c.tagline}_`);
  if (c.description) overviewLines.push(c.description);
  const facts: string[] = [];
  if (c.founded) facts.push(`**Founded:** ${c.founded}`);
  if (c.headquarters) facts.push(`**HQ:** ${c.headquarters}`);
  if (c.industry) facts.push(`**Industry:** ${c.industry}`);
  if (c.employeeCount) facts.push(`**Employees:** ${c.employeeCount}`);
  if (c.website) facts.push(`**Website:** ${c.website}`);
  if (facts.length) overviewLines.push(facts.join(" · "));
  sections.push({ heading: "Overview", body: overviewLines.join("\n\n") || "No overview available." });

  if (dossier.founders?.length) {
    const body = dossier.founders
      .map((f) => `**${f.name}** — ${f.role}\n\n${f.background}${f.linkedin ? `\n\n[LinkedIn](${f.linkedin})` : ""}`)
      .join("\n\n---\n\n");
    sections.push({ heading: "Founders & Leadership", body });
  }

  if (dossier.boardAndAdvisors?.length) {
    const body = dossier.boardAndAdvisors
      .map((b) => `- **${b.name}** — ${b.role}${b.affiliation ? `, ${b.affiliation}` : ""}${b.background ? `. ${b.background}` : ""}`)
      .join("\n");
    sections.push({ heading: "Board & Advisors", body });
  }

  const f = dossier.funding;
  if (f && (f.totalRaised || f.latestRound || f.investors?.length || dossier.fundingRounds?.length)) {
    const lines: string[] = [];
    if (f.totalRaised) lines.push(`**Total raised:** ${f.totalRaised}`);
    if (f.latestRound) lines.push(`**Latest round:** ${f.latestRound}`);
    if (f.latestValuation) lines.push(`**Latest valuation:** ${f.latestValuation}`);
    if (f.investors?.length) lines.push(`**Investors:** ${f.investors.join(", ")}`);
    if (dossier.fundingRounds?.length) {
      lines.push("");
      lines.push("| Date | Round | Amount | Lead |");
      lines.push("| --- | --- | --- | --- |");
      for (const r of dossier.fundingRounds) {
        lines.push(`| ${r.date ?? "—"} | ${r.type} | ${r.amount} | ${r.leadInvestor ?? "—"} |`);
      }
    }
    sections.push({ heading: "Funding", body: lines.join("\n") });
  }

  if (dossier.keyProducts?.length) {
    const body = dossier.keyProducts.map((p) => `**${p.name}** — ${p.description}`).join("\n\n");
    sections.push({ heading: "Products & Services", body });
  }

  const m = dossier.market;
  if (m && (m.targetMarket || m.marketSize || m.businessModel)) {
    const parts: string[] = [];
    if (m.targetMarket) parts.push(`**Target market.** ${m.targetMarket}`);
    if (m.marketSize) parts.push(`**Market size.** ${m.marketSize}`);
    if (m.businessModel) parts.push(`**Business model.** ${m.businessModel}`);
    sections.push({ heading: "Market & Business Model", body: parts.join("\n\n") });
  }

  if (dossier.competitors?.length) {
    const body = dossier.competitors
      .map((x) => `**${x.name}**\n\n${x.description}\n\n_Differentiation:_ ${x.differentiation}`)
      .join("\n\n---\n\n");
    sections.push({ heading: "Competitive Landscape", body });
  }

  if (dossier.recentNews?.length) {
    const body = dossier.recentNews
      .map((n) => `**${n.title}**${n.date ? ` — ${n.date}` : ""}${n.source ? ` · _${n.source}_` : ""}\n\n${n.summary}`)
      .join("\n\n---\n\n");
    sections.push({ heading: "Recent News", body });
  }

  if (dossier.partnerships?.length) {
    sections.push({ heading: "Partnerships", body: dossier.partnerships.map((p) => `- ${p}`).join("\n") });
  }
  if (dossier.customers?.length) {
    sections.push({ heading: "Notable Customers", body: dossier.customers.map((p) => `- ${p}`).join("\n") });
  }
  if (dossier.awards?.length) {
    sections.push({ heading: "Awards & Recognition", body: dossier.awards.map((p) => `- ${p}`).join("\n") });
  }
  if (dossier.techStack?.length) {
    sections.push({ heading: "Tech Stack", body: dossier.techStack.map((p) => `- ${p}`).join("\n") });
  }

  const si = dossier.strategicInsights;
  if (si && (si.growthTrajectory || si.competitiveAdvantage || si.risks || si.opportunities)) {
    const parts: string[] = [];
    if (si.growthTrajectory) parts.push(`**Growth trajectory.** ${si.growthTrajectory}`);
    if (si.competitiveAdvantage) parts.push(`**Competitive advantage.** ${si.competitiveAdvantage}`);
    if (si.opportunities) parts.push(`**Opportunities.** ${si.opportunities}`);
    if (si.risks) parts.push(`**Risks.** ${si.risks}`);
    sections.push({ heading: "Strategic Insights", body: parts.join("\n\n") });
  }

  if (dossier.redFlags?.length) {
    sections.push({ heading: "Red Flags", body: dossier.redFlags.map((p) => `- ${p}`).join("\n") });
  }

  return sections;
}
