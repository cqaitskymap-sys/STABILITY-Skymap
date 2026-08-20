import { cn } from "@/lib/utils";

export const DEVELOPER_NAME = "Satyajit Patri";
export const DEVELOPER_ORIGIN = "Odisha";
export const DEVELOPER_CREDIT = `Developed by ${DEVELOPER_NAME} from ${DEVELOPER_ORIGIN}`;

export function DeveloperCredit({
  className,
  tone = "muted",
}: {
  className?: string;
  tone?: "muted" | "light" | "dark";
}) {
  const tones = {
    muted: "text-slate-500",
    light: "text-slate-300",
    dark: "text-slate-600",
  };

  return (
    <p className={cn("text-[11px] leading-5", tones[tone], className)}>
      Developed by <span className="font-semibold">{DEVELOPER_NAME}</span> from {DEVELOPER_ORIGIN}
    </p>
  );
}
