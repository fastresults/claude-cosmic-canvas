import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { children: string; className?: string };

/**
 * Editorial Markdown renderer. Display-serif headings, generous rhythm,
 * pull-quote blockquotes, accent list markers. All colors are semantic
 * tokens so light and dark themes both work.
 */
export function Markdown({ children, className }: Props) {
  return (
    <div
      className={`prose max-w-none text-foreground
        prose-headings:font-display prose-headings:text-foreground prose-headings:tracking-tight
        prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-xl prose-h2:font-semibold
        prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-base prose-h3:font-semibold
        prose-p:my-3 prose-p:text-[15px] prose-p:leading-[1.75] prose-p:text-foreground
        prose-strong:text-foreground prose-strong:font-semibold
        prose-a:text-accent hover:prose-a:underline
        prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:leading-relaxed
        prose-li:marker:text-accent
        prose-code:rounded prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
        prose-pre:bg-surface prose-pre:text-foreground
        prose-blockquote:my-6 prose-blockquote:border-l-2 prose-blockquote:border-l-accent
        prose-blockquote:pl-5 prose-blockquote:font-display prose-blockquote:text-lg
        prose-blockquote:italic prose-blockquote:leading-relaxed prose-blockquote:text-foreground
        prose-hr:my-8 prose-hr:border-border
        ${className ?? ""}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
