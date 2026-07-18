// Small explainer sheet: why setup is enforced in a specific order.
// Reassures the user that gating is a feature, not a punishment.
import { EveSheet } from "@/components/primitives/EveSheet";
import { Mic, BookOpen, Compass, Users } from "lucide-react";

export function WhyInOrderSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="Why in this order?">
      <div className="space-y-4 pb-6 text-sm text-muted-foreground">
        <p>
          Each step teaches the next one. Doing them in order means Eve gets
          smarter with every step — not just at the end.
        </p>
        <ol className="space-y-3">
          <li className="flex gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Mic className="h-4 w-4" />
            </span>
            <div>
              <div className="font-medium text-foreground">1. Voice</div>
              <p className="text-xs">
                So everything Eve writes sounds like you — not a chatbot.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <div className="font-medium text-foreground">2. Knowledge</div>
              <p className="text-xs">
                So Eve knows the facts — your work, wins, and stories — before
                writing about them.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Compass className="h-4 w-4" />
            </span>
            <div>
              <div className="font-medium text-foreground">3. Domain</div>
              <p className="text-xs">
                So Eve stays in your lane and doesn't wander into topics you
                don't cover.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <div className="font-medium text-foreground">4. Audience</div>
              <p className="text-xs">
                Eve drafts your audience from the first three steps — you just
                confirm.
              </p>
            </div>
          </li>
        </ol>
        <p className="text-xs">
          Once all four are set, you can edit any of them in any order.
        </p>
      </div>
    </EveSheet>
  );
}
