// Server-only parsing helpers. Never import from client-reachable modules
// at module scope — always dynamic-import from inside a server-fn handler.

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === "string" ? text : Array.isArray(text) ? text.join("\n\n") : "";
}

export function stripHtml(html: string): { title: string | null; text: string; og: Record<string, string> } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? null;

  const og: Record<string, string> = {};
  const metaRe = /<meta\s+[^>]*(?:property|name)=["'](og:[^"']+|twitter:[^"']+|description)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html)) !== null) {
    og[m[1].toLowerCase()] = m[2];
  }

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return { title, text: cleaned, og };
}

const RESUME_HINTS = [
  "work experience",
  "professional experience",
  "employment history",
  "education",
  "skills",
  "certifications",
  "curriculum vitae",
  "résumé",
  "resume",
];

export function detectDocKind(text: string): "resume" | "bio" | "article" | "transcript" | "other" {
  const lower = text.toLowerCase().slice(0, 8000);
  const hits = RESUME_HINTS.filter((h) => lower.includes(h)).length;
  if (hits >= 2) return "resume";
  if (/^\s*(hi|hello|hey|i'?m|i am)\b/i.test(text.slice(0, 200))) return "bio";
  if (/\b\d{1,2}:\d{2}\b/.test(text.slice(0, 2000))) return "transcript";
  return "article";
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
