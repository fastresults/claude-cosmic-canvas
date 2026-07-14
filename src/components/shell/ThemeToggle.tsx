import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import type { Theme } from "@/lib/theme/theme";

const ORDER: Theme[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "system"
      ? "Theme: system, tap to switch to light"
      : theme === "light"
        ? "Theme: light, tap to switch to dark"
        : "Theme: dark, tap to switch to system";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-elev hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
