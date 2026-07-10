type Props = { value: number; max: number; size?: number };

/** Simple ring using SVG + design tokens. */
export function ProgressRing({ value, max, size = 40 }: Props) {
  const pct = max <= 0 ? 0 : Math.min(1, value / max);
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-border" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="fill-none stroke-accent transition-[stroke-dashoffset]"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[10px] font-medium text-foreground">
        {value}/{max}
      </span>
    </div>
  );
}
