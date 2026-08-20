"use client";

import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, EyeOff, Inbox, Loader2, type LucideIcon } from "lucide-react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const variants = {
    primary:
      "bg-gradient-to-b from-teal-500 to-teal-600 text-white shadow-[0_1px_2px_rgba(13,148,136,0.35),0_8px_18px_-8px_rgba(13,148,136,0.55)] hover:from-teal-600 hover:to-teal-700",
    secondary: "bg-slate-100/90 text-slate-800 hover:bg-slate-200/90",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-sm hover:from-rose-600 hover:to-rose-700",
    outline: "border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:translate-y-px",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

const fieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 transition focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }>(
  function Input({ className, label, error, hint, id, type, ...props }, ref) {
    const inputId = id || props.name;
    const [passwordVisible, setPasswordVisible] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (passwordVisible ? "text" : "password") : type;

    return (
      <label className="block space-y-1.5">
        {label ? (
          <span className="text-sm font-medium text-slate-700">
            {label}
            {props.required ? <span className="text-rose-500"> *</span> : null}
          </span>
        ) : null}
        <span className="relative block">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={cn(
              fieldClass,
              isPassword && "pr-10",
              error && "border-rose-400 focus:border-rose-500 focus:ring-rose-200/70",
              className
            )}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPasswordVisible((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-700"
            >
              {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : null}
        </span>
        {hint && !error ? <span className="block text-xs text-slate-500">{hint}</span> : null}
        {error ? <span className="block text-xs text-rose-600">{error}</span> : null}
      </label>
    );
  }
);

export function Select({
  className,
  label,
  error,
  hint,
  children,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: string; children: ReactNode }) {
  const selectId = id || props.name;
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-sm font-medium text-slate-700">
          {label}
          {props.required ? <span className="text-rose-500"> *</span> : null}
        </span>
      ) : null}
      <select
        id={selectId}
        className={cn(
          fieldClass,
          error && "border-rose-400",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {hint && !error ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

export function Textarea({
  className,
  label,
  error,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-sm font-medium text-slate-700">
          {label}
          {props.required ? <span className="text-rose-500"> *</span> : null}
        </span>
      ) : null}
      <textarea
        className={cn(
          "min-h-24 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] transition focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-200/70",
          className
        )}
        {...props}
      />
      {hint && !error ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("surface-card rounded-2xl", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100/90 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "yellow" | "orange" | "red" | "blue" | "teal" | "purple";
}) {
  const tones = {
    slate: "bg-slate-100/90 text-slate-700 ring-slate-200/80",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    yellow: "bg-amber-50 text-amber-700 ring-amber-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    purple: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1", tones[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "slate" | "green" | "yellow" | "orange" | "red" | "blue" | "teal" | "purple"> = {
    Active: "green",
    Available: "green",
    Upcoming: "green",
    Matched: "green",
    Completed: "green",
    Withdrawn: "blue",
    "Partially Withdrawn": "teal",
    "Due Soon": "yellow",
    "Due Today": "orange",
    Overdue: "red",
    Missed: "red",
    "Variance Found": "orange",
    "Investigation Required": "red",
    Adjusted: "purple",
    Disposed: "slate",
    Depleted: "slate",
    "Fully Withdrawn": "blue",
    "Under Reconciliation": "orange",
    "Under Maintenance": "yellow",
    Inactive: "slate",
    Draft: "slate",
    "SAMPLE CHARGED": "green",
    "SAMPLE ALLOCATED": "teal",
    "SAMPLE WITHDRAWN": "blue",
    "SAMPLE TRANSFERRED": "teal",
    "SAMPLE RETURNED": "green",
    "SAMPLE ADJUSTED": "purple",
    "SAMPLE DISPOSED": "slate",
  };
  return <Badge tone={map[status] || "slate"}>{status}</Badge>;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  tone = "teal",
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "teal" | "blue" | "indigo" | "amber" | "rose" | "emerald";
}) {
  const tones = {
    teal: "from-teal-500/15 to-teal-500/5 text-teal-700",
    blue: "from-sky-500/15 to-sky-500/5 text-sky-700",
    indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-700",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-700",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-700",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
  };
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-slate-200/50 to-transparent" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-[1.7rem] font-semibold leading-none tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className={cn("rounded-2xl bg-gradient-to-br p-2.5 shadow-inner", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-slate-100 p-3.5 text-slate-500 ring-1 ring-slate-200/80">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-12 rounded-xl" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-rose-50 p-3.5 text-rose-600 ring-1 ring-rose-100">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>
      {onRetry ? (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading,
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      aria-label={placeholder}
    />
  );
}
