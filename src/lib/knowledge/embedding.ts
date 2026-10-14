import { MODELS } from "@/lib/ai/models";
// Chunker + embedding dimension constant. Client-safe (no server imports).
// NOTE: knowledge_entries.embedding and knowledge_chunks.embedding are vector(1536).
// If you change EMBED_MODEL to a different-dim model, you MUST also resize
// the columns and rebuild the HNSW index.
export const EMBED_MODEL = MODELS.embedding;
export const EMBED_DIM = 1536;

const TARGET_CHARS = 3200; // ~800 tokens
const OVERLAP_CHARS = 400;

/**
 * Sentence-aware chunker. Splits on paragraph/sentence boundaries when
 * possible, falls back to hard character windows for long unbroken text.
 */
export function chunkText(input: string, target = TARGET_CHARS, overlap = OVERLAP_CHARS): string[] {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  if (text.length <= target) return [text];

  // Split into candidate segments (paragraph, then sentence).
  const paragraphs = text.split(/\n{2,}/);
  const segments: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= target) {
      segments.push(p);
      continue;
    }
    // sentence split
    const sentences = p.split(/(?<=[.!?])\s+/);
    let buf = "";
    for (const s of sentences) {
      if ((buf + " " + s).length > target && buf) {
        segments.push(buf);
        buf = s;
      } else {
        buf = buf ? `${buf} ${s}` : s;
      }
      if (s.length > target) {
        // absurdly long sentence — hard split
        for (let i = 0; i < s.length; i += target) segments.push(s.slice(i, i + target));
        buf = "";
      }
    }
    if (buf) segments.push(buf);
  }

  // Pack segments into chunks with overlap.
  const chunks: string[] = [];
  let current = "";
  for (const seg of segments) {
    if (!current) {
      current = seg;
      continue;
    }
    if ((current + "\n\n" + seg).length <= target) {
      current = `${current}\n\n${seg}`;
    } else {
      chunks.push(current);
      const tail = current.slice(-overlap);
      current = `${tail}\n\n${seg}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
