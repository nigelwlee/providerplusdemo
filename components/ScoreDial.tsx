import type { OverallReadiness } from "@/lib/types";

const READINESS_COLOR: Record<OverallReadiness, string> = {
  "audit-ready": "#027a48",
  "minor gaps": "#f08021",
  "significant gaps": "#b42318",
};

const READINESS_LABEL: Record<OverallReadiness, string> = {
  "audit-ready": "Audit-ready",
  "minor gaps": "Minor gaps",
  "significant gaps": "Significant gaps",
};

export function ScoreDial({
  score,
  readiness,
}: {
  score: number;
  readiness: OverallReadiness;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = READINESS_COLOR[readiness];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="var(--pp-beige-darkest)"
            strokeWidth="12"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold text-pp-text-primary">{clamped}</span>
          <span className="text-xs text-pp-text-primary/60">/ 100</span>
        </div>
      </div>
      <span
        className="rounded-full px-3 py-1 text-sm font-semibold"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        {READINESS_LABEL[readiness]}
      </span>
    </div>
  );
}
