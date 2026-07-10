import { useMemo } from "react";
import { useSearch } from "@tanstack/react-router";
import { usePresets } from "./usePresets";

/**
 * Resolves the active preset: `?preset=<id>` overrides `is_default`.
 * Returns null when no preset is set.
 */
export function useActivePreset() {
  const { presets } = usePresets();
  // useSearch across every route: strict:false lets it work outside a specific route.
  const search = useSearch({ strict: false }) as { preset?: string };
  return useMemo(() => {
    if (!presets.length) return null;
    if (search.preset) {
      const found = presets.find((p) => p.id === search.preset);
      if (found) return found;
    }
    return presets.find((p) => p.is_default) ?? null;
  }, [presets, search.preset]);
}
