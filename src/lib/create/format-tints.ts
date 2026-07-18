import { CREATE_FORMATS, type CreateCategory } from "@/config/createFormats";

export type FormatTint = {
  bg: string;
  border: string;
  dot: string;
  label: string;
};

const CATEGORY_TINTS: Record<CreateCategory, FormatTint> = {
  "long-form": {
    bg: "bg-[color-mix(in_oklab,var(--accent)_10%,var(--surface))]",
    border: "border-[color-mix(in_oklab,var(--accent)_35%,var(--border))]",
    dot: "bg-accent",
    label: "text-accent",
  },
  sequence: {
    bg: "bg-[color-mix(in_oklab,var(--primary)_10%,var(--surface))]",
    border: "border-[color-mix(in_oklab,var(--primary)_30%,var(--border))]",
    dot: "bg-primary",
    label: "text-primary",
  },
  speaking: {
    bg: "bg-[color-mix(in_oklab,oklch(0.72_0.15_75)_12%,var(--surface))]",
    border: "border-[color-mix(in_oklab,oklch(0.72_0.15_75)_35%,var(--border))]",
    dot: "bg-[oklch(0.75_0.15_75)]",
    label: "text-[oklch(0.8_0.13_75)]",
  },
  "short-form": {
    bg: "bg-[color-mix(in_oklab,oklch(0.68_0.17_150)_10%,var(--surface))]",
    border: "border-[color-mix(in_oklab,oklch(0.68_0.17_150)_30%,var(--border))]",
    dot: "bg-[oklch(0.72_0.17_150)]",
    label: "text-[oklch(0.78_0.15_150)]",
  },
  campaign: {
    bg: "bg-[color-mix(in_oklab,oklch(0.65_0.2_330)_10%,var(--surface))]",
    border: "border-[color-mix(in_oklab,oklch(0.65_0.2_330)_30%,var(--border))]",
    dot: "bg-[oklch(0.7_0.2_330)]",
    label: "text-[oklch(0.78_0.17_330)]",
  },
  research: {
    bg: "bg-[color-mix(in_oklab,oklch(0.65_0.16_220)_10%,var(--surface))]",
    border: "border-[color-mix(in_oklab,oklch(0.65_0.16_220)_30%,var(--border))]",
    dot: "bg-[oklch(0.7_0.16_220)]",
    label: "text-[oklch(0.78_0.14_220)]",
  },
  media: {
    bg: "bg-[color-mix(in_oklab,oklch(0.65_0.2_20)_10%,var(--surface))]",
    border: "border-[color-mix(in_oklab,oklch(0.65_0.2_20)_30%,var(--border))]",
    dot: "bg-[oklch(0.7_0.2_20)]",
    label: "text-[oklch(0.78_0.17_20)]",
  },
};

const FALLBACK: FormatTint = {
  bg: "bg-surface",
  border: "border-border",
  dot: "bg-muted-foreground",
  label: "text-muted-foreground",
};

export function getFormatTint(formatId: string): FormatTint {
  const fmt = CREATE_FORMATS.find((f) => f.id === formatId);
  if (!fmt) return FALLBACK;
  return CATEGORY_TINTS[fmt.category] ?? FALLBACK;
}
