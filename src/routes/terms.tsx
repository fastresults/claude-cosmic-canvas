import { createFileRoute, Link } from "@tanstack/react-router";
import { Markdown } from "@/components/primitives/Markdown";

const CONTENT = `# Terms of Service

_Last updated: July 18, 2026_

These terms govern your use of **Eve OS** ("the Service"). By creating an account or using the Service, you agree to them.

## 1. The Service

Eve OS is a voice-first AI content operating system that helps you draft, organize, and publish content. Features may change as we improve the product.

## 2. Your account

You are responsible for the security of your account and the accuracy of the information you provide. You must be at least 16 years old to create an account.

## 3. Your content

You retain full ownership of the content, voice recordings, knowledge, and media you upload. You grant us a limited license to store and process that content solely to operate the Service on your behalf.

## 4. Acceptable use

Do not use the Service to generate or distribute content that is unlawful, deceptive, infringing, or that violates the rights of others. Do not attempt to reverse engineer, disrupt, or overload the Service.

## 5. AI output

AI-generated output may contain inaccuracies. You are responsible for reviewing and approving anything you publish. The Service is provided "as is" without warranties of merchantability or fitness for a particular purpose.

## 6. Cancellation

You may delete your account at any time from Settings. We may suspend accounts that violate these terms.

## 7. Limitation of liability

To the maximum extent permitted by law, our aggregate liability is limited to the amount you paid for the Service in the preceding twelve months.

## 8. Changes

We may update these terms; material changes will be announced in-app at least seven days before they take effect.

## 9. Contact

Questions? Email **support@askeve.app**.
`;

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Eve OS" },
      { name: "description", content: "The terms that govern your use of Eve OS." },
      { property: "og:title", content: "Terms of Service — Eve OS" },
      { property: "og:description", content: "The terms that govern your use of Eve OS." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
