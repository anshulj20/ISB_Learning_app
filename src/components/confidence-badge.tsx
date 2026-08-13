import { confidenceLabel } from "@/lib/format";

// Deliberately no traffic-light colors — PROJECT_SPEC.md: "no alarm
// styling, just honesty." Confidence reads through weight/tracking/
// opacity, not red/amber/green. THIN is styled thin, literally.
export function ConfidenceBadge({
  confidence,
}: {
  confidence: "HIGH" | "PARTIAL" | "THIN";
}) {
  const styles: Record<string, string> = {
    HIGH: "font-medium tracking-wider text-text",
    PARTIAL: "font-normal tracking-wider text-text/70",
    THIN: "font-light tracking-widest text-text/45",
  };
  return (
    <span className={`text-[11px] uppercase ${styles[confidence]}`}>
      {confidenceLabel(confidence)}
    </span>
  );
}
