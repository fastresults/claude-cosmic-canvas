import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Orb } from "@/components/primitives/Orb";
import { Pill } from "@/components/primitives/Pill";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

const SUGGESTIONS = [
  "Draft a LinkedIn post about our v2 launch",
  "6-week campaign for the product update",
  "Hot take on this week's news",
  "Reply to the pricing thread",
];

function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-8"
      >
        <Orb size={220} />

        <div className="text-center">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">
            Hold to speak.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Say one sentence. Eve does the rest.
          </p>
        </div>

        <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Pill key={s} variant="ghost" size="sm">
              {s}
            </Pill>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
