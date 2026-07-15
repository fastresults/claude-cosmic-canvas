import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { children: string; className?: string };

export function Markdown({ children, className }: Props) {
  return (
    <div
      className={`prose prose-sm max-w-none text-foreground
        prose-headings:text-foreground prose-headings:font-semibold
        prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
        prose-p:text-foreground prose-p:leading-relaxed
        prose-strong:text-foreground prose-strong:font-semibold
        prose-a:text-accent hover:prose-a:underline
        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
        prose-code:rounded prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
        prose-pre:bg-surface prose-pre:text-foreground
        prose-blockquote:border-l-accent prose-blockquote:text-muted-foreground
        prose-hr:border-border
        ${className ?? ""}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
