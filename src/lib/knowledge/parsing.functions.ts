// Client-safe server function surface for document/URL/LinkedIn parsing.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ParseDocInput = z.object({
  fileBase64: z.string().min(1),
  mimeType: z.string().min(1),
  fileName: z.string().optional(),
});

export const parseDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ParseDocInput.parse(i))
  .handler(async ({ data }) => {
    const { base64ToBytes, extractPdfText, detectDocKind } = await import("./parsing.server");
    const bytes = base64ToBytes(data.fileBase64);
    const mime = data.mimeType.toLowerCase();
    let markdown = "";

    if (mime.includes("pdf")) {
      markdown = await extractPdfText(bytes);
    } else if (mime.startsWith("text/") || mime.includes("markdown") || mime.includes("json")) {
      markdown = new TextDecoder("utf-8").decode(bytes);
    } else if (mime.includes("word") || mime.includes("officedocument")) {
      throw new Error(
        "DOCX not yet supported — please export to PDF or paste the text directly.",
      );
    } else {
      // best-effort text decode
      try {
        markdown = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error(`Unsupported file type: ${mime}`);
      }
    }

    markdown = markdown.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
    const detectedKind = detectDocKind(markdown);
    return {
      markdown,
      detectedKind,
      fileName: data.fileName ?? null,
      mimeType: mime,
      byteLength: bytes.length,
    };
  });

const ScrapeUrlInput = z.object({ url: z.string().url() });

export const scrapeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ScrapeUrlInput.parse(i))
  .handler(async ({ data }) => {
    const { stripHtml } = await import("./parsing.server");
    const res = await fetch(data.url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Fetch failed [${res.status}]`);
    const html = await res.text();
    const { title, text, og } = stripHtml(html);
    return {
      url: data.url,
      title: og["og:title"] ?? title,
      description: og["og:description"] ?? og["description"] ?? null,
      image: og["og:image"] ?? null,
      markdown: text.slice(0, 30000),
    };
  });

const ScrapeLinkedInInput = z.object({ url: z.string().url() });

export const scrapeLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ScrapeLinkedInInput.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LINKEDIN_SCRAPER_KEY;
    if (!key) {
      throw new Error(
        "LinkedIn scraping requires a LINKEDIN_SCRAPER_KEY. Ask the workspace owner to add it, or upload your résumé instead.",
      );
    }
    // Proxycurl-shaped call. Users can point the same key at any compatible provider.
    const endpoint = new URL("https://nubela.co/proxycurl/api/v2/linkedin");
    endpoint.searchParams.set("url", data.url);
    endpoint.searchParams.set("skills", "include");
    endpoint.searchParams.set("use_cache", "if-present");
    const res = await fetch(endpoint.toString(), {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LinkedIn scrape failed [${res.status}]: ${body.slice(0, 200)}`);
    }
    const raw = (await res.json()) as Record<string, unknown>;

    const roles = Array.isArray(raw.experiences)
      ? (raw.experiences as Array<Record<string, unknown>>).map((e) => ({
          title: String(e.title ?? ""),
          company: String(e.company ?? ""),
          start: fmtDate(e.starts_at),
          end: fmtDate(e.ends_at),
          summary: String(e.description ?? ""),
        }))
      : [];
    const education = Array.isArray(raw.education)
      ? (raw.education as Array<Record<string, unknown>>).map((e) => ({
          school: String(e.school ?? ""),
          degree: String(e.degree_name ?? ""),
          field: String(e.field_of_study ?? ""),
          start: fmtDate(e.starts_at),
          end: fmtDate(e.ends_at),
        }))
      : [];
    const skills = Array.isArray(raw.skills)
      ? (raw.skills as Array<Record<string, unknown> | string>).map((s) =>
          typeof s === "string" ? s : String(s.name ?? ""),
        )
      : [];

    return {
      full_name: String(raw.full_name ?? ""),
      headline: String(raw.headline ?? ""),
      about: String(raw.summary ?? ""),
      roles,
      education,
      skills: skills.filter(Boolean),
      achievements: Array.isArray(raw.accomplishment_honors_awards)
        ? (raw.accomplishment_honors_awards as Array<Record<string, unknown>>).map((a) =>
            String(a.title ?? ""),
          )
        : [],
    };
  });

function fmtDate(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const d = v as { year?: number; month?: number };
  if (!d.year) return null;
  return d.month ? `${d.year}-${String(d.month).padStart(2, "0")}` : String(d.year);
}
