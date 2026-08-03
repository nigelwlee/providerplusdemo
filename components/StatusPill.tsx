import type { StandardStatus } from "@/lib/types";

const STATUS_CONFIG: Record<StandardStatus, { label: string; bg: string; fg: string; dot: string }> = {
  met: { label: "Met", bg: "bg-pp-success-bg", fg: "text-pp-success", dot: "bg-pp-success" },
  partial: { label: "Partial", bg: "bg-[#fff4e5]", fg: "text-pp-orange-text", dot: "bg-pp-orange-text" },
  gap: { label: "Gap", bg: "bg-pp-error-bg", fg: "text-pp-error", dot: "bg-pp-error" },
  not_addressed: {
    label: "Not addressed",
    bg: "bg-pp-beige-darkest",
    fg: "text-pp-text-primary/70",
    dot: "bg-pp-text-primary/50",
  },
};

export function StatusPill({ status }: { status: StandardStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.fg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
