interface RingGaugeProps {
  percentage: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
}

export function RingGauge({
  percentage,
  label,
  size = 112,
  strokeWidth = 10,
  accentColor,
}: RingGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    accentColor ||
    (clamped >= 75 ? '#16A34A' : clamped >= 45 ? '#D97706' : '#DC2626');

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${clamped}% ${label}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
          {clamped}%
        </span>
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
      </div>
    </div>
  );
}
