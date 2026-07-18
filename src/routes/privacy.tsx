import { createFileRoute, Link } from "@tanstack/react-router";
import { Markdown } from "@/components/primitives/Markdown";

const CONTENT = `# Privacy Policy

_Last updated: July 18, 2026_

**Eve OS** is designed to keep your voice, knowledge, and content private. This policy explains what we collect, why, and how you control it.

## What we collect

- **Account data.** Email, display name, and authentication identifiers you use to sign in.
- **Your content.** Drafts, voice recordings, transcripts, knowledge entries, media uploads, and orchestrator runs.
- **Usage signals.** Anonymized events (route visits, latency, error traces) used to keep the Service reliable.

## What we do not collect

We do not sell your data. We do not use your content to train foundation models. We do not run third-party advertising trackers inside the app.

## How we use it

- To generate drafts, images, and research on your explicit request.
- To store and search your Second Brain.
- To operate authentication, billing, and support.
- To detect abuse and preserve the integrity of the Service.

## Processors

We use a small set of subprocessors (cloud hosting, AI model providers, email delivery). A current list is available on request at **support@askeve.app**. Every subprocessor operates under a data-processing agreement.

## Your rights

You can export, correct, or delete your data at any time from **Settings → Account**. Deleted content enters a 30-day recovery window in **Settings → Trash** before permanent purge.

## Retention

Active data is retained for the life of your account. Audit logs are retained for 12 months. Backups roll on a 30-day cycle.

## Security

Data is encrypted in transit and at rest. Row-level security policies scope every read and write to the owning account. Service credentials are rotated on a regular cadence.

## Contact

Email the data protection team at **privacy@askeve.app**.
`;

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Eve OS" },
      { name: "description", content: "How Eve OS collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — Eve OS" },
      { property: "og:description", content: "How Eve OS collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          to="/"
          className="mb-6 inline-block text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Eve
        </Link>
        <article className="prose prose-invert max-w-none">
          <Markdown>{CONTENT}</Markdown>
        </article>
      </div>
    </div>
  );
}
