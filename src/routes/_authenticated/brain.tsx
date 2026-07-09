import { createFileRoute } from "@tanstack/react-router";
import { BrainCanvas } from "@/components/brain/BrainCanvas";

export const Route = createFileRoute("/_authenticated/brain")({
  component: Brain,
});

function Brain() {
  return (
    <div className="fixed inset-0 top-14 bottom-32">
      <BrainCanvas />
    </div>
  );
}
